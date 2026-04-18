/* ══════════════════════════════════════════════════════════════════════════
   POST /api/account/delete — 회원 탈퇴 (Session 8-E)

   요청 흐름:
   1) CSRF 가드 (enforceSameOrigin)
   2) Rate Limit — account_delete (3 req / 15 m, IP 기준)
   3) requireAuth 동급 가드 — getClaims() 로 userId 확인
   4) 재인증 확인 — body.confirm === '탈퇴' (실수 방지)
   5) RPC delete_account(userId) — 활성 구독 체크 + orders 익명화 + cancelled/expired 구독 삭제
   6) supabaseAdmin.auth.admin.deleteUser(userId) — profiles/addresses CASCADE
   7) 서버 세션 쿠키 signOut — 다음 요청에서 인증 해제
   8) 로그 + 200 응답

   정책 (docs/milestone.md Session 8-E · 리서치 2026-04-17):
   - 활성/일시정지 구독 있으면 409 subscription_active — 선 해지 후 탈퇴
   - 주문 이력은 PII 익명화 후 5년 보존 (전자상거래법 §6)
   - auth.users 삭제 실패 시 orphan PII=[DELETED] 허용 (안전 방향) + 500 반환

   에러 매핑:
   - RPC 'subscription_active' → 409 conflict (detail: 'subscription_active')
   - RPC 'user_id_required'    → 400 validation_failed (이론상 도달 불가)
   - admin.deleteUser 실패     → 500 server_error (orphan 경고 로그)
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  logAuthEvent,
  maskEmail,
  extractIp,
  extractUserAgent,
} from '@/lib/auth/logger';

/** 재인증용 확인 문자열 — 클라이언트가 정확히 이 값을 전송해야 실제 삭제 진행. */
const CONFIRM_PHRASE = '탈퇴';

export async function POST(request: Request): Promise<Response> {
  const ip = extractIp(request);
  const userAgent = extractUserAgent(request);

  /* 1) CSRF */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit */
  const limited = await checkRateLimit(request, 'account_delete');
  if (limited) return limited;

  /* 3) 인증 필수 */
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { userId, email } = claims;
  const emailMasked = maskEmail(email);

  /* 4) 재인증 문자열 확인 — body: { confirm: "탈퇴" } */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }
  const confirm =
    body !== null && typeof body === 'object' && 'confirm' in body
      ? (body as { confirm: unknown }).confirm
      : undefined;
  if (typeof confirm !== 'string' || confirm !== CONFIRM_PHRASE) {
    return apiError('validation_failed', { detail: 'confirm_phrase_mismatch' });
  }

  const admin = getSupabaseAdmin();

  /* 5) RPC — 활성 구독 체크 + orders 익명화 + cancelled/expired 구독 삭제 */
  const { data: rpcData, error: rpcError } = await admin.rpc('delete_account', {
    p_user_id: userId,
  });

  if (rpcError) {
    /* PostgREST 는 raise exception 의 message 를 error.message 에 담는다 */
    const msg = rpcError.message ?? '';
    if (msg.includes('subscription_active')) {
      logAuthEvent({
        event: 'account.delete.blocked',
        emailMasked,
        outcome: 'blocked',
        errorCode: 'subscription_active',
        userId,
        ip,
        userAgent,
      });
      return apiError('conflict', { detail: 'subscription_active' });
    }

    /* 그 외 RPC 오류는 내부 에러 — 로그에 code 만 남기고 detail 노출 금지 */
    console.error('[account.delete] RPC failed', {
      code: rpcError.code,
      msg: msg.slice(0, 200),
    });
    logAuthEvent({
      event: 'account.delete.failed',
      emailMasked,
      outcome: 'failed',
      errorCode: 'rpc_failed',
      userId,
      ip,
      userAgent,
    });
    return apiError('server_error');
  }

  /* 6) auth.users 삭제 — profiles/addresses CASCADE */
  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId);

  if (deleteAuthErr) {
    /* orphan 상태: orders 는 이미 익명화 완료, auth.users 만 남음.
       안전 방향(PII 이미 파기)이며 admin 이 수동 복구 가능. */
    console.error('[account.delete] auth.admin.deleteUser failed — ORPHAN', {
      userId,
      code: deleteAuthErr.status,
    });
    logAuthEvent({
      event: 'account.delete.failed',
      emailMasked,
      outcome: 'failed',
      errorCode: 'auth_delete_failed',
      userId,
      ip,
      userAgent,
    });
    return apiError('server_error');
  }

  /* 7) 세션 무효화 — 현재 쿠키로 signOut 시도 (실패해도 계정은 이미 삭제됨) */
  try {
    const supabase = await createRouteHandlerClient();
    await supabase.auth.signOut();
  } catch (err) {
    /* 세션 쿠키 정리 실패는 치명 아님 — 다음 요청 시 getUser() 가 null 반환 */
    console.error('[account.delete] signOut after delete failed', err);
  }

  /* 8) 성공 로그 + 응답 */
  const rpcResult = (rpcData ?? {}) as {
    orders_anonymized?: number;
    subscriptions_deleted?: number;
  };

  logAuthEvent({
    event: 'account.delete.success',
    emailMasked,
    outcome: 'success',
    userId,
    ip,
    userAgent,
  });

  return apiSuccess({
    deleted: true,
    ordersAnonymized: rpcResult.orders_anonymized ?? 0,
    subscriptionsDeleted: rpcResult.subscriptions_deleted ?? 0,
  });
}
