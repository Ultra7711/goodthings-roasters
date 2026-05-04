/* ══════════════════════════════════════════
   PreviewLayout — /preview/* (S148 PR-2 advisory §6.1 D-1 라이브 미리보기)

   책임:
   - admin 한정 미리보기 화면을 메인 페이지 layout (Header / Footer / AnnouncementBar)
     없이 단독 렌더 — 어드민 폼이 iframe 으로 임베드해서 4 brk 시각 검증.
   - SRInitializer 마운트 — sr-img / sr-txt visible 토글 자연 작동.
   - cream bg 위 sand chapter — 메인 페이지 컨텍스트 동일 시각.
   - admin 가드는 각 page.tsx 가 자체 처리 (page 단위 정책).

   주의:
   - /preview/* 는 production 검색 인덱싱 차단 (robots noindex).
   - frame-ancestors 'self' 는 메인 페이지(`/`)만 허용 — /preview/* 는 'none' 유지.
     → iframe 임베드 시 차단 → proxy.ts pathname 분기 확장 필요.
   ══════════════════════════════════════════ */

import { Suspense, type ReactNode, type CSSProperties } from 'react';
import SRInitializerClient from './SRInitializerClient';
import PreviewHeightSync from './PreviewHeightSync';

const WRAPPER_STYLE: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-background-primary)',
};

export const metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div style={WRAPPER_STYLE}>
      <Suspense fallback={null}>{children}</Suspense>
      <SRInitializerClient />
      <PreviewHeightSync />
    </div>
  );
}
