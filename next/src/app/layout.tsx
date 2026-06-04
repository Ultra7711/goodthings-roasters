import { Suspense, type ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import NextTopLoader from 'nextjs-toploader';
import AuthSyncProvider from '@/components/auth/AuthSyncProvider';
import Providers from '@/components/providers/Providers';
import { SiteSettingsProvider } from '@/components/providers/SiteSettingsProvider';
import OverscrollColor from '@/components/ui/OverscrollColor';
import TouchHoverGuard from '@/components/ui/TouchHoverGuard';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationJsonLd, localBusinessJsonLd } from '@/lib/seo/jsonLd';
import './globals.css';
import '@/styles/forms.css';
import '@/components/layout/HeaderIcons.css';

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
  metadataBase: new URL('https://goodthingsroasters.com'),
  title: {
    default: '굳띵즈 로스터스 - Good Things Roasters',
    template: '%s - 굳띵즈 로스터스',
  },
  description: 'good things, simply roasted. - 스페셜티 커피 로스터리',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '굳띵즈 로스터스',
    title: '굳띵즈 로스터스 - Good Things Roasters',
    description: 'good things, simply roasted. - 스페셜티 커피 로스터리',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: '굳띵즈 로스터스 - Good Things Roasters',
    description: 'good things, simply roasted. - 스페셜티 커피 로스터리',
  },
};

/* S263 — iOS 26 Safari Liquid Glass toolbar tinting + safe-area 지원.
   viewport-fit=cover 필수 (toolbar tinting 정확 동작 + env(safe-area-inset-*) 활용). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1E1B16',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  /* BUG-006 D-007 (2026-04-23): `await headers()` 제거.
     nonce 기반 CSP 가 제거되어 전역 dynamic rendering 강제가 불필요해졌다.
     Next.js 가 이제 정적 최적화 가능한 라우트를 shell 로 prerender 할 수 있다.

     S129 H-5: site_settings fetch ('use cache' + cacheTag 적용 → 정적 캐싱).
     어드민 저장 시 revalidateTag('site-settings') 로 무효화. */
  const siteSettings = await fetchSiteSettings();

  return (
    <html lang="ko" className={`${inter.variable} ${pretendard.variable} antialiased`}>
      <head>
        <link rel="preload" as="image" href="/images/hero/hero-poster.webp" fetchPriority="high" />
        {/* iOS Safari 데이터 디텍터 — 이메일·전화번호 자동 링크 변환 방지 */}
        <meta name="format-detection" content="telephone=no, email=no, address=no" />
        {/* S283: <head> 안 inline script — body parse 전 발화 → <html> 에 class 박음.
           다크 라우트 (/·/story) 첫 진입 시 .root light bg 비춰 보이는 흰 플래시 차단.
           useLayoutEffect / NavigationVisibilityGate 는 hydration 이후라 첫 paint 미coverage. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=['/','/story'];if(d.indexOf(location.pathname)>=0){document.documentElement.classList.add('dest-dark');}})();`,
          }}
        />
      </head>
      {/* Providers: QueryClientProvider + CartDrawerProvider (ADR-004 Step B).
          AuthSyncProvider: Supabase 세션 → Zustand 동기화 브리지 (P0-2) +
          로그인/로그아웃 시 ['cart'] 캐시 invalidate. */}
      <body>
        {/* SEO: 전역 structured data — Organization + 매장(LocalBusiness·영업시간 site_settings.hours 재활용). */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={localBusinessJsonLd(siteSettings.hours)} />
        {/* Next.js 16 cacheComponents: dynamic [param] 라우트 prerender 시
            usePathname / window 접근 클라 컴포넌트는 Suspense 로 격리해야 함. */}
        <Suspense fallback={null}>
          <NextTopLoader color="#7A6B52" height={2} showSpinner={false} />
        </Suspense>
        <Suspense fallback={null}>
          <OverscrollColor />
        </Suspense>
        <Suspense fallback={null}>
          <TouchHoverGuard />
        </Suspense>
        <div className="page-bg">
          <SiteSettingsProvider initial={siteSettings}>
            <Providers>
              <AuthSyncProvider>{children}</AuthSyncProvider>
            </Providers>
          </SiteSettingsProvider>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
