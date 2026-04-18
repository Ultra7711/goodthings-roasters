/* ══════════════════════════════════════════════════════════════════════════
   /api/cart — 장바구니 조회(GET) + 담기(POST) (Session 12)

   흐름:
   - GET: 인증 필수. listCartItems() 가 RLS 로 본인 행만 반환.
   - POST: CSRF → RL → zod → getClaims → cartService.addCartItem → 201.

   보안:
   - authenticated 전용. 미인증 401.
   - 게스트는 localStorage 사용 — 이 엔드포인트 호출 불가.

   참조:
   - next/src/lib/repositories/cartRepo.ts
   - next/src/lib/services/cartService.ts
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { CartItemInputSchema } from '@/lib/schemas/cart';
import { addCartItem } from '@/lib/services/cartService';
import { listCartItems } from '@/lib/repositories/cartRepo';
import { OrderServiceError } from '@/lib/services/orderService';

export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    const items = await listCartItems();
    return apiSuccess({ items });
  } catch (err) {
    console.error('[GET /api/cart] unexpected error', err);
    return apiError('server_error');
  }
}

export async function POST(request: Request): Promise<Response> {
  /* 1) CSRF */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit */
  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  /* 3) 인증 필수 — 게스트는 localStorage 사용 */
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  /* 4) 입력 검증 */
  const parsed = await parseBody(request, CartItemInputSchema);
  if (!parsed.success) return parsed.response;

  /* 5) 서비스 호출 */
  try {
    const item = await addCartItem(claims.userId, parsed.data);
    return apiSuccess({ item }, 201);
  } catch (err) {
    if (err instanceof OrderServiceError) {
      switch (err.code) {
        case 'product_not_found':
        case 'volume_not_found':
        case 'volume_sold_out':
          return apiError('conflict', { detail: err.code });
        case 'subscription_not_allowed':
          return apiError('validation_failed', {
            detail: err.code,
            status: 400,
          });
        default:
          return apiError('server_error');
      }
    }
    /* Postgres 23505 (unique_violation) — cart upsert 동시성 경합.
       partial unique index 가 잡아낸 경우 409 로 변환하여 클라이언트가 재시도. */
    if (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: unknown }).code === '23505'
    ) {
      return apiError('conflict', { detail: 'cart_concurrent_update' });
    }
    console.error('[POST /api/cart] unexpected error', err);
    return apiError('server_error');
  }
}
