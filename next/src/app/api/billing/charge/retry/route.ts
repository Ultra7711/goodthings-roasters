/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/charge/retry — 정기배송 회차 청구 재시도(dunning) 배치 (R-3a)

   GET → subscription_billing_failures 에서 retry_at<=now AND resolved_at IS NULL 인
   미해결 실패를 구독 단위로 모아 chargeRecurringCycle 을 재호출한다.
   - 성공: process_recurring_billing_charge(107)가 해당 구독 미해결 실패를 resolve.
   - 재실패: recordBillingFailure 가 새 실패 기록 + 다음 retry_at. 소진/영구(retry_at null)
     이면 pause_subscription_for_billing 으로 구독 일시정지(무한 재청구 차단).

   인증: isCronRequest(x-cron-secret | Bearer). Vercel Cron(매일 KST 11시) 트리거.
   격리: 건별 try-catch, 부분 실패도 200(Vercel 무의미 재시도 방지).
   빈도: Hobby 매일 1회로 충분(retry_at 24/48/72h 단위). Pro 전환 후 상향은 백로그.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { isCronRequest } from '@/lib/auth/cronAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  chargeRecurringCycle,
  BillingServiceError,
  RECURRING_SKIP_CODES,
} from '@/lib/services/billingService';

/* 구독 단위 재시도 상한(Vercel 300s budget). 실패 행은 구독당 다수일 수 있어 행 조회는 넉넉히. */
const BATCH_LIMIT = 200;
const ROW_SCAN_LIMIT = 1000;

export async function GET(request: Request): Promise<Response> {
  if (!isCronRequest(request)) return apiError('unauthorized');

  const admin = getSupabaseAdmin();

  /* 도래한 미해결 실패 조회(오래된 retry_at 우선) → 구독 단위 dedup. */
  const { data: rows, error } = await admin
    .from('subscription_billing_failures')
    .select('subscription_id')
    .lte('retry_at', new Date().toISOString())
    .is('resolved_at', null)
    .order('retry_at', { ascending: true })
    .limit(ROW_SCAN_LIMIT);
  if (error) {
    console.error('[billing.charge.retry] 실패 큐 조회 실패', {
      ...(process.env.NODE_ENV !== 'production' && { msg: error.message.slice(0, 200) }),
    });
    return apiError('server_error');
  }

  const allIds = (rows ?? []).map((r) => (r as { subscription_id: string }).subscription_id);
  const uniqueIds = [...new Set(allIds)];
  const overLimit = uniqueIds.length > BATCH_LIMIT;
  const targets = overLimit ? uniqueIds.slice(0, BATCH_LIMIT) : uniqueIds;

  let recovered = 0;
  let stillFailing = 0;
  let skipped = 0;
  const failedIds: string[] = [];

  for (const id of targets) {
    try {
      await chargeRecurringCycle({ subscriptionId: id });
      recovered += 1;
    } catch (err) {
      if (err instanceof BillingServiceError && RECURRING_SKIP_CODES.has(err.code)) {
        /* 멱등·보류(이미 청구됨·비활성·데이터 미비) — 재시도 큐에서 자연 해소되거나 보류. */
        skipped += 1;
      } else {
        /* 재실패 — recordBillingFailure 가 다음 retry_at 또는 paused 처리(서비스 내부). */
        stillFailing += 1;
        failedIds.push(id);
      }
    }
  }

  if (overLimit) {
    console.warn('[billing.charge.retry] 재시도 상한 초과 — 잔여는 다음 실행으로 이월', {
      limit: BATCH_LIMIT,
      total: uniqueIds.length,
    });
  }
  console.info('[billing.charge.retry] 재시도 배치 완료', {
    recovered,
    stillFailing,
    skipped,
    overLimit,
    ...(failedIds.length > 0 && { failedIds }),
  });

  /* 부분 실패도 200 — Vercel 무의미 재시도 방지. */
  return apiSuccess({ recovered, stillFailing, skipped, total: targets.length, overLimit });
}
