/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/customer-key — 회원 customer_key 조회 (Phase 3-B · ADR-008 §D-5)

   GET : 회원만. profiles.customer_key 반환 (UUID).
         CheckoutPayment 빌링 위젯이 payment({ customerKey }) 초기화 시 사용.

   설계:
   - 단순 조회 (RLS service-role only billing_methods 와 무관).
   - profiles 테이블 RLS 가 본인 row SELECT 허용 + 서비스 키로 보완 조회.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('customer_key')
    .eq('id', claims.userId)
    .maybeSingle<{ customer_key: string }>();

  if (error) {
    console.error('[billing.customer-key.GET] db error', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: error.message?.slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
  if (!data) return apiError('unauthorized');

  return apiSuccess({ customerKey: data.customer_key });
}
