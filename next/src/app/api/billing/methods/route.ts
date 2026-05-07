/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/methods — 사용자 빌링 카드 목록 (Phase 3-A · ADR-008 §3.4)

   GET : 회원 본인의 active billing_methods 목록 (마스킹 정보만, billing_key 제외)

   설계:
   - 회원만 (D-5)
   - billing_key 절대 노출 금지 — billingService.listBillingMethods 가 type 으로 차단
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { listBillingMethods } from '@/lib/services/billingService';

export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    const methods = await listBillingMethods(claims.userId);
    return apiSuccess({ methods });
  } catch (err) {
    console.error('[billing.methods.GET] query failed', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
}
