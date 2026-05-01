/* ══════════════════════════════════════════
   Good Days Route — /gooddays
   - Server component: searchParams.img 을 prop 으로 받아 GoodDaysPage 에 전달.
     (이전 구현은 client component 의 useSearchParams 사용 → Suspense fallback 흰 100svh div
      → 메인→굿데이즈 ?img= 진입 시 푸터 위로/cream flash 발생 → 라이트박스 검정 전환 시 flash)
   - Suspense fallback 은 fixed inset:0 검정(.gd-suspense-fallback)로 page entry 동안 풀 viewport
     검정 유지 → 라이트박스 검정으로 자연 전환.
   - 헤더 테마 light, headerThemeConfig 에 등록.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import GoodDaysPage from '@/components/gooddays/GoodDaysPage';

export const metadata = { title: '좋은 순간들 — good things' };

type Props = {
  searchParams: Promise<{ img?: string }>;
};

async function GoodDaysContent({ searchParams }: Props) {
  const params = await searchParams;
  return <GoodDaysPage initialImgSrc={params.img ?? null} />;
}

export default function GoodDaysRoute({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="gd-suspense-fallback" aria-hidden="true" />}>
      <GoodDaysContent searchParams={searchParams} />
    </Suspense>
  );
}
