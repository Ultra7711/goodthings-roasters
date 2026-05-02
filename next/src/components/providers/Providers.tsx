/* ══════════════════════════════════════════════════════════════════════════
   Providers — 루트 클라이언트 프로바이더 컴포지션 (ADR-004 Step B)

   - QueryClientProvider (TanStack Query)
   - CartDrawerProvider (카트 드로어 UI 상태)
   ══════════════════════════════════════════════════════════════════════════ */

'use client';

import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartDrawerProvider } from '@/contexts/CartDrawerContext';
import CartDrawer from '@/components/cart/CartDrawer';

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
      <CartDrawerProvider>
        {children}
        {/* CartDrawer 는 useCartQuery (TanStack Query) 가 dynamic data 를 접근.
            Next.js 16 cacheComponents 의 dynamic [param] 라우트 prerender 에서
            "Uncached data outside Suspense" 로 build fail → Suspense 래핑.
            평소 닫힌 상태로 hidden translateX, fallback null 안전. */}
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      </CartDrawerProvider>
    </QueryClientProvider>
  );
}
