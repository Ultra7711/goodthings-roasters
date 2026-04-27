/* ══════════════════════════════════════════
   /search — SRP 라우트
   Next.js 16: useSearchParams() 는 Suspense 경계 필수.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import SearchPage from '@/components/search/SearchPage';
import SearchSkeleton from '@/components/search/SearchSkeleton';

export const metadata = {
  title: '검색 | Good Things Roasters',
  description: '원두, 드립백, 카페 메뉴를 검색하세요.',
};

export default function Page() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPage />
    </Suspense>
  );
}
