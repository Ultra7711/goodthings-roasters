/* ══════════════════════════════════════════════════════════════════════════
   useOrders — TanStack Query Order History adapter (S161 PR-1)

   ADR-004 + UBIQUITOUS_LANGUAGE.md "Order History" Module 의 데이터 seam.
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { Order } from '@/types/order';

type ApiEnvelope<T> = { data?: T; error?: { code?: string } };

export const ORDERS_QUERY_KEY = ['orders'] as const;

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`orders_fetch_${res.status}`);
  const body = (await res.json()) as ApiEnvelope<Order[]>;
  return body.data ?? [];
}

export function useOrdersQuery() {
  const query = useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: fetchOrders,
    staleTime: 30_000,
  });
  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
