/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders/guest-lookup — 게스트 주문 조회 (P2-A-4)

   요청 흐름:
   1) CSRF 가드 (Origin 검증 — Pass 1 H-2)
   2) Rate Limit (guest_pin: 5 req / 10 m, IP 기준) — 브루트포스 방어
   3) zod 검증 (GuestLookupSchema: orderNumber + email + pin)
   4) findGuestOrderWithHash (service_role, user_id IS NULL + email 일치)
   5) argon2 verify — 기록 없거나 해시 불일치면 동일 404 응답
      (주문번호·이메일·PIN 세 요소 중 어느 것이 틀렸는지 구분 불가하게 함)
      Pass 1 H-1: 기록이 없어도 더미 argon2 verify 를 수행하여 타이밍 공격 완화.
   6) 성공 → 200 { data: { order } } (guest_lookup_pin_hash 제거 후 반환)

   OWASP ASVS §6.6.3:
   - PIN 검증 엔드포인트는 IP 기준 rate limiting 필수.
   - 실패 응답은 단일화 (account enumeration 방지).
   - argon2id 사용 (@node-rs/argon2).
   ══════════════════════════════════════════════════════════════════════════ */

import { verify as argon2Verify } from '@node-rs/argon2';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { findGuestOrderWithHash } from '@/lib/repositories/orderRepo';
import { GuestLookupSchema } from '@/lib/schemas/order';

/* ── Pass 1 H-1: 타이밍 공격 완화용 더미 argon2id 해시 ─────────────────
   실제 PIN 이 아닌 무의미한 문자열('__dummy__')을 OWASP 파라미터로 해시한 값.
   레코드가 없을 때도 argon2Verify 를 호출해 응답 시간 차이를 제거한다.
   (memoryCost 19456 / timeCost 2 / parallelism 1 / Argon2id)
   → 실제로 어떤 PIN 과도 일치하지 않음. */
const DUMMY_PIN_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXkxMjM0NTY3OA$6ZyS6WWuGH0zF7P0PmYL1mH3RgU5Bk8rGJKn6yXZ4Ck';

export async function POST(request: Request): Promise<Response> {
  /* 1) CSRF 가드 */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit — PIN 브루트포스 방어 */
  const limited = await checkRateLimit(request, 'guest_pin');
  if (limited) return limited;

  /* 3) 입력 검증 */
  const parsed = await parseBody(request, GuestLookupSchema);
  if (!parsed.success) return parsed.response;
  const { orderNumber, email, pin } = parsed.data;

  try {
    /* 4) DB 조회 (service_role) */
    const row = await findGuestOrderWithHash(orderNumber, email);

    /* 5) 동일 404 — 존재/부존재 구분 누설 차단
       Pass 1 H-1: 레코드 부재 경로에서도 더미 argon2 verify 를 수행하여
       성공·실패 응답 시간 차를 제거. 결과는 사용하지 않고 버린다. */
    if (!row || !row.guest_lookup_pin_hash) {
      await argon2Verify(DUMMY_PIN_HASH, pin).catch(() => false);
      return apiError('not_found');
    }

    const ok = await argon2Verify(row.guest_lookup_pin_hash, pin);
    if (!ok) return apiError('not_found');

    /* 6) 응답 payload — PIN 해시는 절대 반환 금지 */
    const { guest_lookup_pin_hash, ...order } = row;
    void guest_lookup_pin_hash; /* 명시적 폐기 */
    return apiSuccess({ order });
  } catch (err) {
    console.error('[POST /api/orders/guest-lookup] unexpected error', err);
    return apiError('server_error');
  }
}
