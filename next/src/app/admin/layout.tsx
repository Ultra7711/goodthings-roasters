/* ══════════════════════════════════════════
   Admin Root Layout
   - 어드민 전용 테마 (.admin-root) 적용. 메인 사이트 토큰과 격리.
   - 인증 가드는 (authed) 라우트 그룹에서 처리. 본 레이아웃은 /admin/login 도 포함.
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Toaster } from '@/components/admin/ui/sonner';
import './admin-theme.css';

export const metadata: Metadata = {
  title: 'Admin · Good Things Roasters',
  description: '어드민 — 운영 콘솔',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-root min-h-screen">
      {children}
      <Toaster richColors position="top-right" />
    </div>
  );
}
