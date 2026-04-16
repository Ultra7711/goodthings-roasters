/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders/guest-lookup — 게스트 주문 조회 (P2-A-4)

   요청 흐름:
   1) Rate Limit (guest_pin: 5 req / 10 m, IP 기준) — 브루트포스 방어
   2) zod 검증 (GuestLookupSchema: orderNumber + email + pin)
   3) findGuestOrderWithHash (service_role, user_id IS NULL + email 일치)
   4) argon2 verify — 기록 없거나 해시 불일치면 동일 404 응답
      (주문번호·이메일·PIN 세 요소 중 어느 것이 틀렸는지 구분 불가하게 함)
   5) 성공 → 200 { data: { order } } (guest_lookup_pin_hash 제거 후 반환)

   OWASP ASVS §6.6.3:
   - PIN 검증 엔드포인트는 IP 기준 rate limiting 필수.
   - 실패 응답은 단일화 (account enumeration 방지).
   - argon2id 사용 (@node-rs/argon2).
   ══════════════════════════════════════════════════════════════════════════ */

import { verify as argon2Verify } from '@node-rs/argon2';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { findGuestOrderWithHash } from '@/lib/repositories/orderRepo';
import { GuestLookupSchema } from '@/lib/schemas/order';

export async function POST(request: Request): Promise<Response> {
  /* 1) Rate Limit — PIN 브루트포스 방어 */
  const limited = await checkRateLimit(request, 'guest_pin');
  if (limited) return limited;

  /* 2) 입력 검증 */
  const parsed = await parseBody(request, GuestLookupSchema);
  if (!parsed.success) return parsed.response;
  const { orderNumber, email, pin } = parsed.data;

  try {
    /* 3) DB 조회 (service_role) */
    const row = await findGuestOrderWithHash(orderNumber, email);

    /* 4) 동일 404 — 존재/부존재 구분 누설 차단 */
    if (!row || !row.guest_lookup_pin_hash) {
      /* 타이밍 공격 완화: 기록이 없어도 가짜 verify 한번 수행은 생략.
         argon2 자체가 상수 시간이 아니고 RPC + RLS 단계에서 이미 노이즈가 큼. */
      return apiError('not_found');
    }

    const ok = await argon2Verify(row.guest_lookup_pin_hash, pin);
    if (!ok) return apiError('not_found');

    /* 5) 응답 payload — PIN 해시는 절대 반환 금지 */
    const { guest_lookup_pin_hash, ...order } = row;
    void guest_lookup_pin_hash; /* 명시적 폐기 */
    return apiSuccess({ order });
  } catch (err) {
    console.error('[POST /api/orders/guest-lookup] unexpected error', err);
    return apiError('server_error');
  }
}
