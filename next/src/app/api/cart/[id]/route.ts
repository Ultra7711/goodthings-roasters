/* ══════════════════════════════════════════════════════════════════════════
   /api/cart/[id] — 카트 아이템 수량 변경(PATCH) · 삭제(DELETE) (Session 12)

   보안:
   - RLS `cart_items_update_own` / `cart_items_delete_own` 이 본인 행만 허용.
   - 타인 id 전달 시 repo 가 null/false 반환 → 404 로 매핑 (존재 여부 누설 방지).
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { CartItemPatchSchema } from '@/lib/schemas/cart';
import {
  deleteCartItem,
  updateCartItemQuantity,
} from '@/lib/repositories/cartRepo';
import { z } from 'zod';

const IdSchema = z.string().uuid();

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) return apiError('not_found');

  const parsed = await parseBody(request, CartItemPatchSchema);
  if (!parsed.success) return parsed.response;

  try {
    const item = await updateCartItemQuantity(id, parsed.data.quantity);
    if (!item) return apiError('not_found');
    return apiSuccess({ item });
  } catch (err) {
    console.error('[PATCH /api/cart/:id] unexpected error', err);
    return apiError('server_error');
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await params;
  if (!IdSchema.safeParse(id).success) return apiError('not_found');

  try {
    const deleted = await deleteCartItem(id);
    if (!deleted) return apiError('not_found');
    return apiSuccess({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/cart/:id] unexpected error', err);
    return apiError('server_error');
  }
}
