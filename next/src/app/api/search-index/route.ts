/* ══════════════════════════════════════════════════════════════════════════
   GET /api/search-index
   - products + cafe_menu 통합 검색 인덱스 데이터 반환 (S215)
   - 헤더 검색 패널 등 클라이언트 측 useSearch hook 의 TanStack Query queryFn 이 호출.
   - SSR prefetch 는 fetchSearchIndex() 를 직접 호출하므로 본 route 미경유.

   캐시: sub-fetch (fetchProducts / fetchCafeMenu) 가 각자 'use cache' + cacheTag 보유.
        어드민 변경 시 revalidateTag 로 자연스럽게 무효화 → 별도 Cache-Control 미설정.
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { fetchSearchIndex } from '@/lib/searchServer';

export async function GET(): Promise<Response> {
  try {
    const data = await fetchSearchIndex();
    return apiSuccess(data);
  } catch (err) {
    console.error('[GET /api/search-index] unexpected error', err);
    return apiError('server_error');
  }
}
