/* ══════════════════════════════════════════════════════════════════════════
   Providers — 루트 클라이언트 프로바이더 컴포지션 (ADR-004 Step B)

   - QueryClientProvider (TanStack Query)
   - CartDrawerProvider (카트 드로어 UI 상태)
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartDrawerProvider } from '@/contexts/CartDrawerContext';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CartDrawerProvider>{children}</CartDrawerProvider>
    </QueryClientProvider>
  );
}
