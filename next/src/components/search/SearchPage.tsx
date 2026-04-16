/* ══════════════════════════════════════════
   SearchPage (client)
   URL `?q=<query>` 읽어 검색 실행 → 결과 리스트 렌더.
   - 입력란에서 추가 수정 가능 (Enter 시 URL 교체 → 재검색).
   - Next.js 16 `useSearchParams()` 는 Suspense 필요 → route page 에서 감쌈.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { ClearIcon, SearchIcon } from '@/components/ui/InputIcons';
import SearchResultCard from './SearchResultCard';
import SearchEmpty from './SearchEmpty';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(initialQuery);
  const { query, results, hasQuery, hasResults } = useSearch(initialQuery);

  /* URL 쿼리 변경 시 인풋값 동기화 (뒤로가기/다른 경로 재진입 대응) */
  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  function submit(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === query) return;
    router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(inputValue);
    }
  }

  function onClear() {
    setInputValue('');
    inputRef.current?.focus();
  }

  return (
    <div className="search-page-wrap">
      <div className="search-page-inner">
        {/* 인풋 라인 */}
        <div className="search-input-row">
          <span className="search-icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="무엇을 찾으시나요?"
            autoComplete="off"
            spellCheck={false}
            aria-label="상품 검색"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {inputValue && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClear}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ClearIcon />
            </button>
          )}
        </div>

        <div className="search-divider-top" />

        {/* 쿼리 레이블 */}
        {hasQuery && (
          <div className="search-query-label">
            <strong>&lsquo;{query}&rsquo;</strong>에 대한 검색 결과 {results.length}건
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
