/* ══════════════════════════════════════════
   SearchPage (client)
   URL `?q=<query>` 읽어 검색 실행 → 결과 리스트 렌더.
   - 입력란은 별도로 두지 않음 — 쿼리 수정은 헤더 검색 버튼으로 패널을 열어 수행.
   - Next.js 16 `useSearchParams()` 는 Suspense 필요 → route page 에서 감쌈.
   - 페이지네이션 없음: 카탈로그 규모상 검색 결과가 50건 미만으로 전체 표시.
     페이지 단위 slice 후 그룹화 시 카테고리가 페이지 경계에서 분리되는 버그 원천 제거.
   ══════════════════════════════════════════ */

'use client';

import './SearchPage.css';
/* sp-card-* 디자인 spec 답습 — SearchResultCard 가 사용. ShopPage CSS 보장. */
import '@/components/shop/ShopPage.css';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import SearchResultCard from './SearchResultCard';
import SearchEmpty from './SearchEmpty';
import type { SearchIndexData, SearchResult } from '@/lib/search/types';

type Props = {
  /* SSR prefetch — useSearch 의 TanStack Query initialData 로 위임 (S215). */
  initialData: SearchIndexData;
};

type Group = {
  key: 'cafe' | 'bean' | 'drip' | 'legal';
  eyebrow: string;
  results: SearchResult[];
};

/* S199 V2 §6.9 — 결과를 카테고리별 그룹화. 메뉴 순서: Cafe Menu → Coffee Beans → Drip Bag → 정책·안내.
   S280: legal 그룹 추가 (맨 마지막 · 상품 결과 우선 노출).
   각 그룹 내 점수 정렬은 useSearch 가 이미 처리 (그룹 내 순서 = 원본 results 순서). */
function groupResults(items: SearchResult[]): Group[] {
  const cafe: SearchResult[] = [];
  const bean: SearchResult[] = [];
  const drip: SearchResult[] = [];
  const legal: SearchResult[] = [];

  for (const r of items) {
    if (r.kind === 'cafe') {
      cafe.push(r);
    } else if (r.kind === 'legal') {
      legal.push(r);
    } else if (r.item.category === 'Coffee Bean') {
      bean.push(r);
    } else if (r.item.category === 'Drip Bag') {
      drip.push(r);
    }
  }

  return [
    { key: 'cafe' as const, eyebrow: 'Cafe Menu', results: cafe },
    { key: 'bean' as const, eyebrow: 'Coffee Beans', results: bean },
    { key: 'drip' as const, eyebrow: 'Drip Bag', results: drip },
    { key: 'legal' as const, eyebrow: '정책 · 안내', results: legal },
  ].filter((g) => g.results.length > 0);
}

export default function SearchPage({ initialData }: Props) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  /* Committed-search: URL = 확정 쿼리. 재검색은 헤더 검색 버튼으로 패널을 열어 수행. */
  const { query, results, hasQuery, hasResults } = useSearch(initialQuery, initialData);

  const groups = useMemo(() => groupResults(results), [results]);

  return (
    <div className="search-page-wrap">
      <div className="search-page-inner">
        {/* 쿼리 레이블 — 결과 0건 시 SearchEmpty 와 중복되므로 숨김 */}
        {hasQuery && hasResults && (
          <div className="search-query-label">
            <strong>&ldquo;{query}&rdquo;</strong>에 대한 검색 결과가 {results.length}건 있습니다.
          </div>
        )}

        {/* 결과 or 빈 상태 */}
        {!hasQuery || !hasResults ? (
          <SearchEmpty query={query} hasQuery={hasQuery} />
        ) : (
          <div className="sr-rows">
            {groups.map((g) => (
              <section className="sr-row" key={g.key} aria-label={g.eyebrow}>
                <header className="sr-row-header">
                  <span className="sr-row-eyebrow">{g.eyebrow}</span>
                  <span className="sr-row-count">{g.results.length}</span>
                </header>
                <div className="sr-grid">
                  {g.results.map((r) => (
                    <SearchResultCard
                      key={`${r.kind}-${r.kind === 'legal' ? r.item.slug : r.kind === 'product' ? r.item.slug : r.item.id}`}
                      result={r}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
