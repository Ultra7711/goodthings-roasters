import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/searchServer.ts — 검색 인덱스 통합 서버 fetch (S215 Group F Phase 3)

   역할:
   - fetchSearchIndex() — products + cafe_menu 병렬 fetch 후 단일 객체 반환
     · SSR prefetch (`/search` 페이지) + API route (`/api/search-index`) 공통 소스
     · 매처 엔진 (engine.ts) 은 그대로 — 데이터 소스만 DB 로 전환

   설계:
   - server-only 격리.
   - productsServer.fetchProducts / cafeMenuServer.fetchCafeMenu 가 각자 'use cache' +
     cacheTag 보유. 본 함수는 추가 캐시 레이어 없이 두 결과를 합쳐 반환.
   - 어드민 변경 시 PRODUCTS_CACHE_TAG / CAFE_MENU_CACHE_TAG 무효화로 자연스럽게 갱신.

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
