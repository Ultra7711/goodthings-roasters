import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
import AuthSyncProvider from '@/components/auth/AuthSyncProvider';
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
  return (
    <html lang="ko" className={`${inter.variable} ${pretendard.variable} antialiased`}>
      {/* AuthSyncProvider: Supabase 세션 → Zustand 동기화 브리지 (P0-2)
          모든 OAuth 완료(Naver·Kakao magic link, Google /auth/callback) 직후
          onAuthStateChange 이벤트를 캐치해 Zustand isLoggedIn을 갱신한다. */}
      <body>
        <AuthSyncProvider>{children}</AuthSyncProvider>
      </body>
    </html>
  );
}
