import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import NextTopLoader from 'nextjs-toploader';
import AuthSyncProvider from '@/components/auth/AuthSyncProvider';
import Providers from '@/components/providers/Providers';
import OverscrollColor from '@/components/ui/OverscrollColor';
import TouchHoverGuard from '@/components/ui/TouchHoverGuard';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const pretendard = localFont({
  src: '../../public/fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Good Things Roasters',
  description: 'good things, simply roasted. — 스페셜티 커피 로스터리',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  /* BUG-006 D-007 (2026-04-23): `await headers()` 제거.
     nonce 기반 CSP 가 제거되어 전역 dynamic rendering 강제가 불필요해졌다.
     Next.js 가 이제 정적 최적화 가능한 라우트를 shell 로 prerender 할 수 있다. */
  return (
    <html lang="ko" className={`${inter.variable} ${pretendard.variable} antialiased`}>
      <head>
        <link rel="preload" as="image" href="/images/hero/hero-poster.jpg" fetchPriority="high" />
      </head>
      {/* Providers: QueryClientProvider + CartDrawerProvider (ADR-004 Step B).
          AuthSyncProvider: Supabase 세션 → Zustand 동기화 브리지 (P0-2) +
          로그인/로그아웃 시 ['cart'] 캐시 invalidate. */}
      <body>
        <NextTopLoader color="#7A6B52" height={2} showSpinner={false} />
        <OverscrollColor />
        <TouchHoverGuard />
        <div className="page-bg">
          <Providers>
            <AuthSyncProvider>{children}</AuthSyncProvider>
          </Providers>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
