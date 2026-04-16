/* ══════════════════════════════════════════
   Search — Data singleton
   PRODUCTS / CAFE_MENU 를 모듈 로드 시 1회 인덱싱 (개선 A).
   UI 레이어는 이 싱글톤을 사용해 검색 수행.
   ══════════════════════════════════════════ */

import { PRODUCTS } from '@/lib/products';
import { CAFE_MENU } from '@/lib/cafeMenu';
import { buildSearchIndex, search } from './engine';
import type { SearchResult } from './types';

/** 모듈 로드 시 1회 인덱싱 — 이후 search 호출마다 재사용 */
const SEARCH_INDEX = buildSearchIndex(PRODUCTS, CAFE_MENU);

/**
 * 전역 검색 — 모든 상품 + 카페 메뉴 대상.
 * 빈 쿼리는 빈 배열. 스코어 내림차순 정렬.
 */
export function searchAll(query: string): SearchResult[] {
  return search(SEARCH_INDEX, query);
}
