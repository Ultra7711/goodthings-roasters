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
  const results = useMemo(() => searchAll(trimmed), [trimmed]);
  return {
    query: trimmed,
    results,
    hasQuery: trimmed.length > 0,
    hasResults: results.length > 0,
  };
}
