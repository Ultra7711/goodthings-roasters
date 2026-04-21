import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import AuthSyncProvider from '@/components/auth/AuthSyncProvider';
import Providers from '@/components/providers/Providers';
import OverscrollColor from '@/components/ui/OverscrollColor';
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  /* CSP nonce: proxy.ts 가 per-request 로 주입한 nonce 를 읽어 동적 렌더링을
     강제한다. 이 호출이 없으면 Next.js 가 정적 최적화로 HTML 을 캐시하여
     proxy 의 nonce 와 script 태그 nonce 가 불일치 → strict-dynamic CSP 가
     모든 inline script 를 차단. headers() 호출이 전역 dynamic rendering 트리거. */
  await headers();

  return (
    <html lang="ko" className={`${inter.variable} ${pretendard.variable} antialiased`}>
      {/* Providers: QueryClientProvider + CartDrawerProvider (ADR-004 Step B).
          AuthSyncProvider: Supabase 세션 → Zustand 동기화 브리지 (P0-2) +
          로그인/로그아웃 시 ['cart'] 캐시 invalidate. */}
      <body>
        <OverscrollColor />
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
