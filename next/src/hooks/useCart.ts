/* ══════════════════════════════════════════════════════════════════════════
   useCart — TanStack Query 기반 장바구니 훅 세트 (ADR-004 Step B)

   단일 소스:
   - 로그인: `/api/cart` (서버 DB + RLS)
   - 게스트: `localStorage['gtr-guest-cart']` (guestCart.ts)
   분기: queryFn / mutationFn 에서 `getSessionSnapshot().isLoggedIn` 확인.
   전환: AuthSyncProvider 가 auth 이벤트 시 `queryClient.invalidateQueries(['cart'])`.

   낙관적 업데이트:
   - onMutate: 캐시 스냅샷 + 즉시 업데이트 + wasLoggedIn 캡처 → context
   - onError: 스냅샷 복원 + console.error (호출부 toast 는 mutation.isError 관찰)
   - onSettled: 로그인 모드만 invalidateQueries (게스트는 localStorage 원천)
   - auth race 방어: onError/onSettled 는 context.wasLoggedIn 참조. mutationFn 만
     fresh read (실제 race window 는 onMutate → mutationFn enqueue 사이 sub-ms).
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartItem, AddToCartPayload } from '@/types/cart';
import type { SubscriptionPeriod } from '@/lib/schemas/order';
import { SUBSCRIPTION_PERIODS } from '@/lib/schemas/order';
import { PRODUCTS } from '@/lib/products';
import { parsePrice } from '@/lib/utils';
import { getSessionSnapshot } from '@/hooks/useSupabaseSession';
import {
  readGuestCart,
  writeGuestCart,
  clearGuestCart,
} from '@/lib/guestCart';

/* ── 배송비 기준 (store.ts 에서 재수출 유지) ── */
export const FREE_SHIPPING_THRESHOLD = 30000;
export const SHIPPING_FEE = 3000;

export const CART_QUERY_KEY = ['cart'] as const;

/* ══════════════════════════════════════════
   내부 유틸
   ══════════════════════════════════════════ */

type ServerCartRow = {
  id: string;
  user_id: string;
  product_slug: string;
  product_volume: string;
  quantity: number;
  unit_price_snapshot: number;
  item_type: CartItem['type'];
  subscription_period: string | null;
  created_at: string;
  updated_at: string;
};

type ApiEnvelope<T> = { data?: T; error?: { code?: string } };

function toSubscriptionPeriod(
  v: string | null | undefined,
): SubscriptionPeriod | null {
  if (v == null) return null;
  return (SUBSCRIPTION_PERIODS as readonly string[]).includes(v)
    ? (v as SubscriptionPeriod)
    : null;
}

function mapRowToCartItem(row: ServerCartRow): CartItem | null {
  const product = PRODUCTS.find((p) => p.slug === row.product_slug);
  if (!product) return null;
  const firstImage = product.images?.[0];
  return {
    id: row.id,
    slug: row.product_slug,
    name: product.name,
    price: product.price,
    priceNum: row.unit_price_snapshot ?? parsePrice(product.price),
    qty: row.quantity,
    color: firstImage?.bg ?? product.color ?? '#ECEAE6',
    image: firstImage?.src ?? null,
    type: row.item_type,
    period: row.subscription_period,
    category: product.category,
    volume: row.product_volume,
  };
}

function payloadToInput(payload: AddToCartPayload) {
  if (!payload.volume) return null;
  const type = payload.type ?? 'normal';
  return {
    productSlug: payload.slug,
    volume: payload.volume,
    quantity: Math.min(99, Math.max(1, payload.qty)),
    itemType: type,
    subscriptionPeriod:
      type === 'subscription' ? toSubscriptionPeriod(payload.period) : null,
  };
}

function newGuestCartItem(payload: AddToCartPayload): CartItem {
  /* 'use client' 환경 — crypto.randomUUID 항상 사용 가능 (TS L-1) */
  return {
    id: crypto.randomUUID(),
    slug: payload.slug,
    name: payload.name,
    price: payload.price,
    priceNum: payload.priceNum ?? parsePrice(payload.price),
    qty: payload.qty,
    color: payload.color ?? '#ECEAE6',
    image: payload.image ?? null,
    type: payload.type ?? 'normal',
    period: payload.period ?? null,
    category: payload.category ?? '',
    volume: payload.volume ?? null,
  };
}

/** 동일 상품(슬러그·타입·주기·용량) 인덱스 — 없으면 -1 */
function findDuplicateIdx(
  items: CartItem[],
  payload: AddToCartPayload,
): number {
  return items.findIndex(
    (i) =>
      i.slug === payload.slug &&
      i.type === (payload.type ?? 'normal') &&
      i.period === (payload.period ?? null) &&
      i.volume === (payload.volume ?? null),
  );
}

/* ══════════════════════════════════════════
   Query
   ══════════════════════════════════════════ */

async function fetchCart(): Promise<CartItem[]> {
  const isLoggedIn = getSessionSnapshot().isLoggedIn;
  if (!isLoggedIn) {
    return readGuestCart();
  }
  const res = await fetch('/api/cart', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) {
    /* silent-fail 방지: throw → useCartQuery.isError 활성, UI 에서 오류 표시 가능 */
    throw new Error(`cart_fetch_${res.status}`);
  }
  const body = (await res.json()) as ApiEnvelope<{ items: ServerCartRow[] }>;
  const rows = body.data?.items ?? [];
  return rows.map(mapRowToCartItem).filter((i): i is CartItem => i !== null);
}

export function useCartQuery() {
  const query = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: fetchCart,
    staleTime: 30_000,
    /* 모바일 일시 단절 대응 — 카트만 retry:2 + 지수 백오프 (silent F-07). */
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  const items: CartItem[] = query.data ?? [];
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.priceNum * i.qty, 0);
  const shippingFee =
    subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const totalPrice = subtotal + shippingFee;

  return {
    items,
    totalQty,
    subtotal,
    shippingFee,
    totalPrice,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/* ══════════════════════════════════════════
   Mutations
   ══════════════════════════════════════════ */

type MutationCtx = { previous: CartItem[] | undefined; wasLoggedIn: boolean };

export function useAddCartItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AddToCartPayload, MutationCtx>({
    mutationFn: async (payload) => {
      const isLoggedIn = getSessionSnapshot().isLoggedIn;
      if (!isLoggedIn) return; /* 게스트: onMutate 에서 localStorage 반영 완료 */
      const input = payloadToInput(payload);
      if (!input) throw new Error('invalid_payload');
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartItem[]>(CART_QUERY_KEY);
      const wasLoggedIn = getSessionSnapshot().isLoggedIn;
      const current = previous ?? [];
      const idx = findDuplicateIdx(current, payload);
      let next: CartItem[];
      if (idx >= 0) {
        next = current.map((item, i) =>
          i === idx
            ? { ...item, qty: Math.min(99, item.qty + payload.qty) }
            : item,
        );
      } else {
        next = [...current, newGuestCartItem(payload)];
      }
      queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, next);
      if (!wasLoggedIn) writeGuestCart(next);
      return { previous, wasLoggedIn };
    },
    onError: (err, _payload, context) => {
      console.error('[useAddCartItem] failed', err);
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!context.wasLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: (_data, _err, _payload, context) => {
      if (context?.wasLoggedIn) {
        queryClient
          .invalidateQueries({ queryKey: CART_QUERY_KEY })
          .catch((err) => console.error('[useCart] invalidate failed', err));
      }
    },
  });
}

export function useUpdateCartQty() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; delta: number },
    MutationCtx & { nextQty: number }
  >({
    mutationFn: async ({ id }) => {
      const isLoggedIn = getSessionSnapshot().isLoggedIn;
      if (!isLoggedIn) return;
      /* delta 는 onMutate 에서 이미 nextQty 로 환산되어 캐시에 반영됨.
         mutationFn 은 캐시의 최신 qty 만 서버로 전송한다. */
      const current = queryClient.getQueryData<CartItem[]>(CART_QUERY_KEY) ?? [];
      const target = current.find((i) => i.id === id);
      if (!target) return;
      const res = await fetch(`/api/cart/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ quantity: target.qty }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
    },
    onMutate: async ({ id, delta }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartItem[]>(CART_QUERY_KEY);
      const wasLoggedIn = getSessionSnapshot().isLoggedIn;
      const current = previous ?? [];
      let nextQty = 0;
      const next = current.map((item) => {
        if (item.id !== id) return item;
        nextQty = Math.min(99, Math.max(1, item.qty + delta));
        return { ...item, qty: nextQty };
      });
      queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, next);
      if (!wasLoggedIn) writeGuestCart(next);
      return { previous, wasLoggedIn, nextQty };
    },
    onError: (err, _vars, context) => {
      console.error('[useUpdateCartQty] failed', err);
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!context.wasLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.wasLoggedIn) {
        queryClient
          .invalidateQueries({ queryKey: CART_QUERY_KEY })
          .catch((err) => console.error('[useCart] invalidate failed', err));
      }
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, MutationCtx>({
    mutationFn: async (id) => {
      const isLoggedIn = getSessionSnapshot().isLoggedIn;
      if (!isLoggedIn) return;
      const res = await fetch(`/api/cart/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<CartItem[]>(CART_QUERY_KEY);
      const wasLoggedIn = getSessionSnapshot().isLoggedIn;
      const next = (previous ?? []).filter((i) => i.id !== id);
      queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, next);
      if (!wasLoggedIn) writeGuestCart(next);
      return { previous, wasLoggedIn };
    },
    onError: (err, _id, context) => {
      console.error('[useRemoveCartItem] failed', err);
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!context.wasLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: (_data, _err, _id, context) => {
      if (context?.wasLoggedIn) {
        queryClient
          .invalidateQueries({ queryKey: CART_QUERY_KEY })
          .catch((err) => console.error('[useCart] invalidate failed', err));
      }
    },
  });
}

/** 로컬 캐시·스토리지만 비움. 서버 카트는 주문 RPC 가 이미 정리.
 *  로그인 모드 invalidate 제거 — setQueryData([]) 직후 refetch 가 서버
 *  정리 완료 전 시점이면 빈 카트를 이전 데이터로 덮을 수 있음 (TS H-2). */
export function useClearCart() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, []);
    if (!getSessionSnapshot().isLoggedIn) clearGuestCart();
  };
}
