/* ══════════════════════════════════════════
   Shop Route — /shop (S69)
   /menu 패턴으로 통일 — Suspense + client useSearchParams.
   - 이전: `async` + `await searchParams` → dynamic 요소로 PPR (◐)
   - 현재: server component 는 Suspense 만 · filter 는 ShopPage 가 직접 읽음
   - 결과: Static (○) 라우트 · Router Cache + Activity 보존 → 재진입 시
     DOM 유지 · 연출 중복 없음 · /menu 와 동일 UX
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import ShopPage from '@/components/shop/ShopPage';

export const metadata = { title: '모든 상품 — good things' };

export default function ShopRoute() {
  return (
    <Suspense fallback={<div className="sp-page-bg" style={{ minHeight: '100dvh' }} />}>
      <ShopPage />
    </Suspense>
  );
}
