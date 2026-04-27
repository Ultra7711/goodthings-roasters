/* ══════════════════════════════════════════
   MyPageLayout
   마이페이지는 사이트 헤더·푸터 없이
   자체 미니 헤더만 사용하는 독립 레이아웃.
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';
import OverscrollTop from '@/components/ui/OverscrollTop';

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* BUG-165 (S88): 독립 레이아웃 (자체 미니 헤더 + light bg) — 기본
          OverscrollTop 색(#1E1B16/#4A4845)이 부조화 → light 통일. */}
      <OverscrollTop top="#FBF8F3" bottom="#FBF8F3" />
      {children}
      <ToastContainer />
    </>
  );
}
