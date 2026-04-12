/* ══════════════════════════════════════════
   Good Days Route — /gooddays
   RP-6c 재이식: 프로토타입 #gd-page 이식.
   - GoodDaysPage 는 클라이언트 컴포넌트 (IO 리빌 + 라이트박스 키보드)
   - 헤더 테마 light, headerThemeConfig 에 등록
   ══════════════════════════════════════════ */

import GoodDaysPage from '@/components/gooddays/GoodDaysPage';

export const metadata = { title: '좋은 순간들 — good things' };

export default function GoodDaysRoute() {
  return <GoodDaysPage />;
}
