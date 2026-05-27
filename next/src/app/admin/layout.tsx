/* ══════════════════════════════════════════
   Admin Root Layout
   - 어드민 전용 테마 (.admin-root) 적용. 메인 사이트 토큰과 격리.
   - 인증 가드는 (authed) 라우트 그룹에서 처리. 본 레이아웃은 /admin/login 도 포함.
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Toaster } from '@/components/admin/ui/sonner';
/* admin-theme.css 는 globals.css 에서 @import 됨 (Tailwind v4 의 @theme 처리 보장).
   여기서 별도 import 하면 중복 + Tailwind 외부 CSS 청크 처리되어 @theme 무효화 위험. */

export const metadata: Metadata = {
  title: {
    default: '관리자',
    template: '%s - 굳띵즈 로스터스',
  },
  description: '어드민 — 운영 콘솔',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="gtr-admin min-h-screen">
      {children}
      {/* AdminTopbar(56px sticky) 와 겹치지 않도록 top offset = 56 + 16 여유 = 72. */}
      <Toaster richColors position="top-right" offset={{ top: 72, right: 16 }} />
    </div>
  );
}
