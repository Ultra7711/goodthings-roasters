/* ══════════════════════════════════════════════════════════════════════════
   useCart — TanStack Query 기반 장바구니 훅 세트 (ADR-004 Step B)

   단일 소스:
   - 로그인: `/api/cart` (서버 DB + RLS)
   - 게스트: `localStorage['gtr-guest-cart']` (guestCart.ts)
   분기: queryFn / mutationFn 에서 `useAuthStore.getState().isLoggedIn` 확인.
   전환: AuthSyncProvider 가 auth 이벤트 시 `queryClient.invalidateQueries(['cart'])`.

   낙관적 업데이트:
   - onMutate: 캐시 스냅샷 + 즉시 업데이트
   - onError: 스냅샷 복원 + toast (호출부 책임)
   - onSettled: 로그인 모드만 invalidateQueries (게스트는 localStorage 원천)
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartItem, AddToCartPayload } from '@/types/cart';
import type { SubscriptionPeriod } from '@/lib/schemas/order';
import { SUBSCRIPTION_PERIODS } from '@/lib/schemas/order';
import { PRODUCTS } from '@/lib/products';
import { parsePrice } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
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
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
  const isLoggedIn = useAuthStore.getState().isLoggedIn;
  if (!isLoggedIn) {
    return readGuestCart();
  }
  const res = await fetch('/api/cart', {
    method: 'GET',
    credentials: 'same-origin',
  });
  if (!res.ok) return [];
  const body = (await res.json()) as ApiEnvelope<{ items: ServerCartRow[] }>;
  const rows = body.data?.items ?? [];
  return rows.map(mapRowToCartItem).filter((i): i is CartItem => i !== null);
}

export function useCartQuery() {
  const query = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: fetchCart,
    staleTime: 30_000,
    retry: 1,
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

type MutationCtx = { previous: CartItem[] | undefined };

export function useAddCartItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AddToCartPayload, MutationCtx>({
    mutationFn: async (payload) => {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      if (!isLoggedIn) {
        /* 게스트: localStorage 쓰기는 onMutate 에서 이미 반영 */
        const current = readGuestCart();
        writeGuestCart(current); /* no-op sync — 캐시 반영 보장은 onSettled */
        return;
      }
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
      /* 게스트는 localStorage 도 동기화 */
      if (!useAuthStore.getState().isLoggedIn) writeGuestCart(next);
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!useAuthStore.getState().isLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: () => {
      if (useAuthStore.getState().isLoggedIn) {
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
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
    mutationFn: async ({ id, delta: _delta }) => {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      if (!isLoggedIn) return;
      /* onMutate 에서 이미 nextQty 계산됨 — 캐시에서 다시 읽는다 */
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
      const current = previous ?? [];
      let nextQty = 0;
      const next = current.map((item) => {
        if (item.id !== id) return item;
        nextQty = Math.min(99, Math.max(1, item.qty + delta));
        return { ...item, qty: nextQty };
      });
      queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, next);
      if (!useAuthStore.getState().isLoggedIn) writeGuestCart(next);
      return { previous, nextQty };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!useAuthStore.getState().isLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: () => {
      if (useAuthStore.getState().isLoggedIn) {
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      }
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, MutationCtx>({
    mutationFn: async (id) => {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
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
      const next = (previous ?? []).filter((i) => i.id !== id);
      queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, next);
      if (!useAuthStore.getState().isLoggedIn) writeGuestCart(next);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(CART_QUERY_KEY, context.previous);
        if (!useAuthStore.getState().isLoggedIn) writeGuestCart(context.previous);
      }
    },
    onSettled: () => {
      if (useAuthStore.getState().isLoggedIn) {
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      }
    },
  });
}

/** 로컬 캐시·스토리지만 비움. 서버 전체 삭제는 별도 API 필요 시 추가.
 *  OrderCompletePage 에서 결제 성공 후 호출 — 서버는 이미 주문 생성 시 카트 정리됨. */
export function useClearCart() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData<CartItem[]>(CART_QUERY_KEY, []);
    if (!useAuthStore.getState().isLoggedIn) clearGuestCart();
    else void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
  };
}
