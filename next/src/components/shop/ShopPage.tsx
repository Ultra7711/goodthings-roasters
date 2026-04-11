'use client';

import { useEffect, useRef, useState } from 'react';
import ShopFilterTabs from './ShopFilterTabs';
import ShopCard from './ShopCard';
import {
  PRODUCTS,
  FILTER_TABS,
  filterProducts,
  SP_PER_PAGE,
  type FilterKey,
} from '@/lib/products';

const COLS = 3;
const CARD_BASE_DELAY_INIT = 420; // 초기 로드: 탭(0.3s) 등장 후 카드 시작 (ms)

export default function ShopPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 초기 마운트 여부 — 필터 전환 시 카드 딜레이 제거
  const isInitRef = useRef(true);

  // 페이지 진입 연출 — 프로토타입 sp-anim 클래스 트리거
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.classList.remove('sp-anim');
    void el.offsetHeight;
    el.classList.add('sp-anim');
    // 마운트 완료 → 이후 필터 전환은 baseDelay 0
    isInitRef.current = false;
  }, []);

  const filtered = filterProducts(PRODUCTS, filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / SP_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * SP_PER_PAGE;
  const items = filtered.slice(start, start + SP_PER_PAGE);

  const activeTab = FILTER_TABS.find((t) => t.key === filter) ?? FILTER_TABS[0];

  function handleFilterChange(key: FilterKey) {
    setFilter(key);
    setPage(1);
  }

  function handlePageChange(next: number) {
    setPage(next);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div id="sp-body" ref={bodyRef}>
      <div id="sp-head">
        <div id="sp-title-area">
          <h1 id="sp-page-title">{activeTab.titleKr}</h1>
          <p id="sp-page-subtitle">{activeTab.subtitleKr}</p>
        </div>

        <ShopFilterTabs active={filter} onChange={handleFilterChange} />
      </div>

      {/* 상품 그리드 */}
      <div id="sp-grid">
        {items.map((product, i) => (
          <ShopCard
            key={`${filter}-${product.slug}`}
            product={product}
            colIndex={i % COLS}
            isSubFilter={filter === 'sub'}
            scrollRoot={bodyRef.current}
            baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
          />
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div id="sp-pagination">
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
    </div>
  );
}
