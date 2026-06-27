/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/charge/run — 정기배송 회차 청구 배치 스케줄러 (R-2b)

   GET → active + 도래(next_delivery_at<=now) + billing_method 보유 구독을 순회하며
   건별 chargeRecurringCycle 을 직접 호출(같은 프로세스). Vercel Cron(매일 KST 10시)이
   트리거하지만, 트리거 분리 설계 — 외부 cron/운영자도 동일 라우트를 호출할 수 있다.

   인증:
   - isCronRequest: x-cron-secret(수동) 또는 Authorization: Bearer(Vercel Cron) timing-safe.
   - 브라우저 호출 아님 → CSRF 예외(csrf.ts).

   격리·멱등:
   - 건별 try-catch → 1건 실패가 배치 전체를 멈추지 않는다.
   - 부분 실패도 200 반환 → Vercel 의 무의미한 자동 재시도 방지(재시도는 R-3 dunning).
   - 중복 청구는 chargeRecurringCycle 내부 멱등(get-or-create + next_delivery 가드)이 차단.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { isCronRequest } from '@/lib/auth/cronAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  chargeRecurringCycle,
  BillingServiceError,
  type BillingServiceErrorCode,
} from '@/lib/services/billingService';

/* Vercel 함수 300s budget 내 안전 상한. 초과분은 다음 실행으로 이월(로깅). */
const BATCH_LIMIT = 200;

/* 정상 보류·멱등(결제 시도 전/데이터 미비) — 실패가 아니라 skip 으로 집계. */
const SKIP_CODES: ReadonlySet<BillingServiceErrorCode> = new Set([
  'already_charged_this_cycle',
  'subscription_not_active',
  'subscription_not_found',
  'subscription_snapshot_missing',
  'billing_method_not_found',
  'no_default_address',
  'product_not_found',
  'profile_not_found',
]);

export async function GET(request: Request): Promise<Response> {
  if (!isCronRequest(request)) return apiError('unauthorized');

  const admin = getSupabaseAdmin();

  /* 도래한 active 구독 조회 (오래된 예정일 우선). billing_method 없는 구독은 청구 불가 → 제외. */
  const { data: subs, error } = await admin
    .from('subscriptions')
    .select('id')
    .eq('status', 'active')
    .not('billing_method_id', 'is', null)
    .lte('next_delivery_at', new Date().toISOString())
    .order('next_delivery_at', { ascending: true })
    .limit(BATCH_LIMIT + 1); // +1 로 상한 초과 감지
  if (error) {
    console.error('[billing.charge.run] 구독 조회 실패', {
      ...(process.env.NODE_ENV !== 'production' && { msg: error.message.slice(0, 200) }),
    });
    return apiError('server_error');
  }

  const rows = (subs ?? []) as Array<{ id: string }>;
  const overLimit = rows.length > BATCH_LIMIT;
  const targets = overLimit ? rows.slice(0, BATCH_LIMIT) : rows;

  let charged = 0;
  let failed = 0;
  let skipped = 0;
  const failedIds: string[] = [];

  for (const sub of targets) {
    try {
      await chargeRecurringCycle({ subscriptionId: sub.id });
      charged += 1;
    } catch (err) {
      if (err instanceof BillingServiceError && SKIP_CODES.has(err.code)) {
        /* 멱등·보류 — 정상 흐름(이미청구·비활성·데이터미비). 실패 기록은 서비스가 담당. */
        skipped += 1;
      } else {
        /* 실제 결제 실패(toss_charge_failed·charge_post_process_failed 등) — 서비스가 이미
           subscription_billing_failures 기록. 배치는 집계만(실패 id 는 로그에만 — 응답 노출 최소화). */
        failed += 1;
        failedIds.push(sub.id);
      }
    }
  }

  if (overLimit) {
    console.warn('[billing.charge.run] 배치 상한 초과 — 잔여는 다음 실행으로 이월', {
      limit: BATCH_LIMIT,
      total: rows.length,
    });
  }
  console.info('[billing.charge.run] 배치 완료', {
    charged,
    failed,
    skipped,
    overLimit,
    ...(failedIds.length > 0 && { failedIds }),
  });

  /* 부분 실패도 200 — Vercel 무의미 재시도 방지. 실패 id 는 응답 미포함(로그만). */
  return apiSuccess({ charged, failed, skipped, total: targets.length, overLimit });
}
