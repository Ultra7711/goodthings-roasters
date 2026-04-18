/* ══════════════════════════════════════════
   useSearch — 쿼리 기반 검색 결과 메모화
   동기 검색이므로 useMemo 로 충분 (서버 통신 없음).
   ══════════════════════════════════════════ */

import { useMemo } from 'react';
import { searchAll } from '@/lib/search/searchData';
import type { SearchResult } from '@/lib/search/types';

export function useSearch(query: string): {
  query: string;
  results: SearchResult[];
  hasQuery: boolean;
  hasResults: boolean;
} {
  const trimmed = query.trim();
  /* SEARCH_INDEX 는 모듈 로드 시 고정되는 싱글톤이므로 deps 에서 생략 안전.
     향후 동적 인덱스(상품 CRUD) 로 전환 시 deps 재검토 필요. */
  const results = useMemo(() => searchAll(trimmed), [trimmed]);
  return {
    query: trimmed,
    results,
    hasQuery: trimmed.length > 0,
    hasResults: results.length > 0,
  };
}
