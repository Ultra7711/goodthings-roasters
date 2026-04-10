/* ══════════════════════════════════════════
   MainLayout
   (main) route group 공통 셸:
   noise-overlay + announcement + header + {children} + footer
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import SRInitializer from '@/components/layout/SRInitializer';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="root">
      {/* 노이즈 텍스처 오버레이 — 프로토타입 .noise-overlay
          z-index는 헤더(50)·딤(40)보다 위, 모달(300)·라이트박스(350)보다 아래.
          --z-top(400)보다 위에 두면 포커스 모달을 덮어서 안 됨.
          현재는 전 요소 위 장식이므로 --z-top+1 = 401 */}
      <div
        className="noise-overlay"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 401,
          pointerEvents: 'none',
          opacity: 0.025,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* 공지 바 (스크롤 시 사라짐) */}
      <AnnouncementBar />

      {/* 헤더 + 검색 드롭 (sticky) */}
      <SiteHeader />

      {/* 페이지 본문 */}
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>

      {/* 푸터 */}
      <SiteFooter />

      {/* Scroll Reveal 초기화 (페이지 이동마다 재관찰) */}
      <SRInitializer />
    </div>
  );
}
