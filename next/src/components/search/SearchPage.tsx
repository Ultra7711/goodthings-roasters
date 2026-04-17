/* ══════════════════════════════════════════
   SearchPage (client)
   URL `?q=<query>` 읽어 검색 실행 → 결과 리스트 렌더.
   - 입력란은 별도로 두지 않음 — 쿼리 수정은 헤더 검색 버튼으로 패널을 열어 수행.
   - Next.js 16 `useSearchParams()` 는 Suspense 필요 → route page 에서 감쌈.
   ══════════════════════════════════════════ */

'use client';

import { useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import SearchResultCard from './SearchResultCard';
import SearchEmpty from './SearchEmpty';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  /* Committed-search: URL = 확정 쿼리. 재검색은 헤더 검색 버튼으로 패널을 열어 수행. */
  const { query, results, hasQuery, hasResults } = useSearch(initialQuery);

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
          <ul className="search-results-list" role="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {results.map((r) => (
              <li key={`${r.kind}-${r.kind === 'product' ? r.item.slug : r.item.id}`}>
                <SearchResultCard result={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
