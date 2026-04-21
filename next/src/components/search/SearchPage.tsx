/* ══════════════════════════════════════════
   SearchPage (client)
   URL `?q=<query>` 읽어 검색 실행 → 결과 리스트 렌더.
   - 입력란은 별도로 두지 않음 — 쿼리 수정은 헤더 검색 버튼으로 패널을 열어 수행.
   - Next.js 16 `useSearchParams()` 는 Suspense 필요 → route page 에서 감쌈.
   ══════════════════════════════════════════ */

'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SP_PER_PAGE, SP_PER_PAGE_MOBILE } from '@/lib/products';
import SearchResultCard from './SearchResultCard';
import SearchEmpty from './SearchEmpty';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  /* Committed-search: URL = 확정 쿼리. 재검색은 헤더 검색 버튼으로 패널을 열어 수행. */
  const { query, results, hasQuery, hasResults } = useSearch(initialQuery);

  const [page, setPage] = useState(1);
  const isMobile = useMediaQuery('(max-width: 479px)');
  const perPage = isMobile ? SP_PER_PAGE_MOBILE : SP_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(results.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageItems = results.slice(start, start + perPage);

  function handlePageChange(next: number) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
          <>
            <ul className="search-results-list" role="list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {pageItems.map((r) => (
                <li key={`${r.kind}-${r.kind === 'product' ? r.item.slug : r.item.id}`}>
                  <SearchResultCard result={r} />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div id="srp-pagination">
                <button
                  className="sp-pg-arrow"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  aria-label="이전 페이지"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M10 3L5 8l5 5" />
                  </svg>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`sp-pg-btn${n === currentPage ? ' active' : ''}`}
                    onClick={() => handlePageChange(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}

                <button
                  className="sp-pg-arrow"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  aria-label="다음 페이지"
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
