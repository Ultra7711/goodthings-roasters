import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Inter } from 'next/font/google';
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
      <body>{children}</body>
    </html>
  );
}
