/* ══════════════════════════════════════════════════════════════════════════
   useDefaultAddress — TanStack Query 기반 기본 배송지 훅 (S174)

   단일 소스: `/api/account/addresses` (서버 DB + RLS)
   게스트는 fetch skip → 항상 null 반환 (silent).

   AuthSyncProvider 가 로그인/로그아웃 시 ['account','address','default']
   query 를 invalidate 하여 캐시를 갱신한다.

   사용 예:
     const { data: address, isLoading } = useDefaultAddressQuery();
     const save = useSaveDefaultAddress();
     save.mutate(newAddress);
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserAddress } from '@/types/address';
import {
  getSessionSnapshot,
  useSupabaseSession,
} from '@/hooks/useSupabaseSession';

export const ACCOUNT_ADDRESS_QUERY_KEY = [
  'account',
  'address',
  'default',
] as const;

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  detail?: string;
};

/* ══════════════════════════════════════════
   Query — GET /api/account/addresses
   ══════════════════════════════════════════ */

async function fetchDefaultAddress(): Promise<UserAddress | null> {
  const isLoggedIn = getSessionSnapshot().isLoggedIn;
  if (!isLoggedIn) return null;

  const res = await fetch('/api/account/addresses', {
    credentials: 'include',
  });

  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`address_fetch_${res.status}`);
  }

  const body = (await res.json()) as ApiEnvelope<UserAddress | null>;
  return body.data ?? null;
}

export function useDefaultAddressQuery() {
  /* enabled gating: 세션 hydration 완료 + 로그인 상태에서만 fetch.
     hydration 전 isLoggedIn=false 인 짧은 시점에 fetchDefaultAddress 가 null 을
     반환해 query 가 success(data=null) 로 settle 되면 "등록된 배송지 정보가
     없습니다." 가 깜빡 표시되는 race 차단. */
  const { isLoggedIn, isLoading: sessionLoading } = useSupabaseSession();
  return useQuery({
    queryKey: ACCOUNT_ADDRESS_QUERY_KEY,
    queryFn: fetchDefaultAddress,
    enabled: !sessionLoading && isLoggedIn,
    staleTime: 60_000,
  });
}

/* ══════════════════════════════════════════
   Mutation — PUT /api/account/addresses
   ══════════════════════════════════════════ */

export function useSaveDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation<UserAddress, Error, UserAddress>({
    mutationFn: async (address) => {
      const res = await fetch('/api/account/addresses', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      });

      if (!res.ok) {
        const body = (await res
          .json()
          .catch(() => null)) as ApiEnvelope<unknown> | null;
        throw new Error(body?.error ?? `address_save_${res.status}`);
      }

      const body = (await res.json()) as ApiEnvelope<UserAddress>;
      if (!body.data) throw new Error('address_save_invalid_response');
      return body.data;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(ACCOUNT_ADDRESS_QUERY_KEY, saved);
    },
  });
}
