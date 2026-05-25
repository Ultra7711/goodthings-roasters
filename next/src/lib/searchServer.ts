import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/searchServer.ts — 검색 인덱스 통합 서버 fetch (S215 Group F Phase 3)

   역할:
   - fetchSearchIndex() — products + cafe_menu 병렬 fetch 후 단일 객체 반환
     · SSR prefetch (`/search` 페이지) + API route (`/api/search-index`) 공통 소스
     · 매처 엔진 (engine.ts) 은 그대로 — 데이터 소스만 DB 로 전환

   설계:
   - server-only 격리.
   - S279-D 후: productsServer.fetchProducts / cafeMenuServer.fetchCafeMenu 가
     각자 'use cache' 폐기 + caller 측 connection() 요구로 전환. 본 wrapper 는
     intermediate 역할만 — 자체 connection() 호출 X.
     이유: caller (/search, /api/search-index) 가 이미 dynamic
     (useSearchParams / API route default) 이므로 추가 connection() 불필요.
     intermediate 에 connection() 추가 시 sub-fetch 의 caller 책임 패턴 (DEC-S279-D-1)
     혼란만 가중.
   - 어드민 변경 시 PRODUCTS_CACHE_TAG / CAFE_MENU_CACHE_TAG 호출은 별 fetcher 의
     historical export 와 일관 (admin actions 코드 변경 회피용).

   참조:
   - DEC-4: 검색 인덱스 = DB 쿼리 + TanStack 캐시 hybrid
   - lib/productsServer.ts / lib/cafeMenuServer.ts (sub-fetch)
   ══════════════════════════════════════════════════════════════════════════ */

import { fetchProducts } from './productsServer';
import { fetchCafeMenu } from './cafeMenuServer';
import { LEGAL_SEARCH_ITEMS } from './legal/searchIndex';
import type { SearchIndexData } from './search/types';

export type { SearchIndexData };

/**
 * 검색 인덱스 데이터 통합 fetch — products + cafe_menu 병렬 + legal docs.
 * sub-fetch 가 각자 'use cache' + cacheTag 를 사용하므로 본 함수는 캐시 비적용.
 * 실패한 도메인은 빈 배열로 fallback (sub-fetch 가 graceful) → 부분 결과라도 노출.
 *
 * S280: legal docs (6 페이지) 정적 import — 모듈 로드 시점 평가. DB 호출 없음.
 */
export async function fetchSearchIndex(): Promise<SearchIndexData> {
  const [products, cafeMenu] = await Promise.all([
    fetchProducts(),
    fetchCafeMenu(),
  ]);
  return {
    products,
    cafeMenu,
    legal: [...LEGAL_SEARCH_ITEMS],
  };
}
