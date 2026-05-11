/* ══════════════════════════════════════════
   useSearch — DB 기반 검색 인덱스 + TanStack Query (S215)

   변경 이력:
   - 이전: searchData.ts 의 모듈 로드 시점 싱글톤 (PRODUCTS + CAFE_MENU 하드코딩) 사용
   - S215: /api/search-index 에서 DB 데이터 fetch + TanStack Query 캐시 (DEC-4)
     · SSR prefetch 가 initialData 로 주입 → 첫 렌더부터 검색 가능
     · staleTime 60s — 동일 쿼리 재검색 시 네트워크 0 (CLAUDE.md 검증 명령 4번)
     · 매처 엔진 (engine.ts / matcher.ts) 은 변경 없음 — 데이터 소스만 전환
   ══════════════════════════════════════════ */

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildSearchIndex, search } from '@/lib/search/engine';
import type { SearchIndexData, SearchResult } from '@/lib/search/types';

export const SEARCH_INDEX_QUERY_KEY = ['search-index'] as const;

type ApiEnvelope<T> = { data?: T; error?: string };

async function fetchSearchIndexData(): Promise<SearchIndexData> {
  const res = await fetch('/api/search-index', {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`search_index_${res.status}`);
  const body = (await res.json()) as ApiEnvelope<SearchIndexData>;
  if (body.error || !body.data) {
    throw new Error(`search_index_${body.error ?? 'empty'}`);
  }
  return body.data;
}

export function useSearch(
  query: string,
  initialData?: SearchIndexData,
): {
  query: string;
  results: SearchResult[];
  hasQuery: boolean;
  hasResults: boolean;
  isLoading: boolean;
} {
  const trimmed = query.trim();

  /* SSR prefetch 가 initialData 를 주면 isLoading=false 즉시 진입 → flash 없음. */
  const { data, isLoading } = useQuery<SearchIndexData>({
    queryKey: SEARCH_INDEX_QUERY_KEY,
    queryFn: fetchSearchIndexData,
    staleTime: 60_000,
    initialData,
  });

  /* data 참조가 동일하면 인덱스 재빌드 없음. SSR initialData 는 stable identity 유지. */
  const index = useMemo(() => {
    if (!data) return [];
    return buildSearchIndex(data.products, data.cafeMenu);
  }, [data]);

  /* 빈 쿼리 fast-return — search(index, '') 도 빈 배열이지만 명시적 단락으로 명확화. */
  const results = useMemo(() => {
    if (!trimmed) return [];
    return search(index, trimmed);
  }, [index, trimmed]);

  return {
    query: trimmed,
    results,
    hasQuery: trimmed.length > 0,
    hasResults: results.length > 0,
    isLoading,
  };
}
