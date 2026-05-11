/* ══════════════════════════════════════════
   /search — SRP 라우트
   - Next.js 16: useSearchParams() 는 Suspense 경계 필수.
   - S215: 서버에서 검색 인덱스 prefetch → SearchPage 에 initialData 전달.
     fetchSearchIndex 의 sub-fetch (fetchProducts / fetchCafeMenu) 가 각자 'use cache' +
     cacheTag 보유 → 빌드 타임 / revalidateTag 무효화 자연스럽게 동작.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import SearchPage from '@/components/search/SearchPage';
import SearchSkeleton from '@/components/search/SearchSkeleton';
import { fetchSearchIndex } from '@/lib/searchServer';

export const metadata = {
  title: '검색 | Good Things Roasters',
  description: '원두, 드립백, 카페 메뉴를 검색하세요.',
};

export default async function Page() {
  const initialData = await fetchSearchIndex();
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPage initialData={initialData} />
    </Suspense>
  );
}
