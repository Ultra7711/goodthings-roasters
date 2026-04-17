/* ══════════════════════════════════════════════════════════════════════════
   cartSync.ts — 로그인 사용자 Zustand ↔ /api/cart 미러 (클라 전용, Session 14)

   목적:
   - 로그인 직후 DB 카트 → Zustand 하이드레이션 (cross-device sync)
   - 로그인 상태에서 addItem/updateQty/removeItem → 서버 미러 fire-and-forget

   한시적 (ADR-004 Step B, Session 15) TanStack Query 도입 시 제거 예정.

   참조:
   - next/src/app/api/cart/route.ts (GET/POST)
   - next/src/app/api/cart/[id]/route.ts (PATCH/DELETE)
   - next/src/lib/repositories/cartRepo.ts (CartItemRow 구조)
   ══════════════════════════════════════════════════════════════════════════ */

import type { CartItem, CartItemType } from '@/types/cart';
import type { CartItemInput } from '@/lib/schemas/cart';
import { SUBSCRIPTION_PERIODS } from '@/lib/schemas/order';
import type { SubscriptionPeriod } from '@/lib/schemas/order';
import { PRODUCTS } from '@/lib/products';
import { parsePrice } from '@/lib/utils';

/** CartItem.period (string | null) → SubscriptionPeriod | null 좁힘. */
export function toSubscriptionPeriod(
  v: string | null | undefined,
): SubscriptionPeriod | null {
  if (v == null) return null;
  return (SUBSCRIPTION_PERIODS as readonly string[]).includes(v)
    ? (v as SubscriptionPeriod)
    : null;
}

/* ── 서버 행 포맷 — repo CartItemRow 와 1:1 대응 (클라에서 타입만 참조) ── */
type ServerCartRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_volume: string;
  quantity: number;
  unit_price_snapshot: number;
  item_type: CartItemType;
  subscription_period: string | null;
  created_at: string;
  updated_at: string;
};

type ApiEnvelope<T> = { data?: T; error?: { code?: string } };

/* ── 서버 행 → UI CartItem 매핑 ─────────────────────────────────────────
   서버는 slug/volume/price snapshot 만 보관. name/color/image/category 는
   클라 PRODUCTS 카탈로그 lookup 으로 재구성. 카탈로그 누락 시 null 반환 후 스킵. */
export function mapRowToCartItem(row: ServerCartRow): CartItem | null {
  const product = PRODUCTS.find((p) => p.slug === row.product_slug);
  if (!product) return null;
  const firstImage = product.images?.[0];
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    serverId: row.id,
    slug: row.product_slug,
    name: product.name,
    price: product.price,
    priceNum: row.unit_price_snapshot || parsePrice(product.price),
    qty: row.quantity,
    color: firstImage?.bg ?? product.color ?? '#ECEAE6',
    image: firstImage?.src ?? null,
    type: row.item_type,
    period: row.subscription_period,
    category: product.category,
    volume: row.product_volume,
  };
}

/* ── GET /api/cart → CartItem[] ────────────────────────────────────── */
export async function fetchServerCart(): Promise<CartItem[]> {
  const res = await fetch('/api/cart', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) return [];
  const body = (await res.json()) as ApiEnvelope<{ items: ServerCartRow[] }>;
  const rows = body.data?.items ?? [];
  return rows
    .map(mapRowToCartItem)
    .filter((i): i is CartItem => i !== null);
}

/* ── POST /api/cart → serverId ─────────────────────────────────────── */
export async function pushAddToServer(
  input: CartItemInput,
): Promise<string | null> {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiEnvelope<{ item: ServerCartRow }>;
    return body.data?.item?.id ?? null;
  } catch {
    return null;
  }
}

/* ── PATCH /api/cart/[id] (치환 quantity) ──────────────────────────── */
export async function pushPatchToServer(
  serverId: string,
  quantity: number,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/cart/${serverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ quantity }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── DELETE /api/cart/[id] ─────────────────────────────────────────── */
export async function pushDeleteToServer(serverId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/cart/${serverId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── CartItem → CartItemInput (POST 페이로드) ──────────────────────── */
export function cartItemToInput(item: CartItem): CartItemInput | null {
  if (!item.volume || item.qty <= 0) return null;
  return {
    productSlug: item.slug,
    volume: item.volume,
    quantity: Math.min(99, Math.max(1, item.qty)),
    itemType: item.type,
    subscriptionPeriod:
      item.type === 'subscription' ? toSubscriptionPeriod(item.period) : null,
  };
}
