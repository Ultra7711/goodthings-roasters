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

export default function ShopPage({ initialFilter = 'all' }: { initialFilter?: FilterKey }) {
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [page, setPage] = useState(1);
  // body element — callback ref 로 받아 scrollRoot 전달 시 리렌더 트리거 보장
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  // 초기 진입 플래그 — 최초 마운트에만 true 여서 첫 카드 stagger 에 0.42s 의
  // baseDelay 가 붙는다 (탭 등장 0.4s 직후 카드가 따라오도록). 이후 필터 전환·
  // 헤더 Shop 재클릭(리셋) 에서는 false 로 유지되어 baseDelay 0 + col stagger 만 동작.
  // useRef 사용: render 중 읽히지만 setState-in-effect 룰과의 충돌을 피하기 위한 의도.
  const isInitRef = useRef(true);

  // 전체 상품 이미지 프리로드 — 최초 마운트에 1회.
  // 탭 전환 시 새 카드 mount 로 인한 이미지 로드 깜빡임 방지.
  useEffect(() => {
    PRODUCTS.forEach((p) => {
      p.images.forEach((im) => {
        if (im.src) {
          const img = new Image();
          img.src = im.src;
        }
      });
    });
  }, []);

  // 페이지 진입 연출 — 프로토타입 sp-anim 클래스 트리거 (최초 마운트에만).
  // 헤더 Shop 재클릭 시엔 래퍼 연출을 재생하지 않고 카드만 remount 되도록 해
  // "탭 전환과 동일한 속도감"을 유지한다.
  useEffect(() => {
    if (!bodyEl) return;
    bodyEl.classList.remove('sp-anim');
    void bodyEl.offsetHeight;
    bodyEl.classList.add('sp-anim');
    // 진입 연출 완료 → 이후 필터 전환·리셋은 baseDelay 0
    isInitRef.current = false;
  }, [bodyEl]);

  /* SiteHeader 의 Shop 링크를 /shop 내에서 클릭했을 때 발송되는
     'gtr:shop-reset' 이벤트 수신 → 스크롤 top + sp-anim 래퍼 리빌 재생만 수행.
     필터/페이지는 건드리지 않는다 — 필터가 바뀌면 카드가 remount 되며
     fade-in 재생이 겹쳐 "과한 연출" 로 보이기 때문. 동일 필터 재클릭과 동일한
     조용한 진입 느낌을 모든 경우에 유지. */
  useEffect(() => {
    function onReset() {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (bodyEl) {
        bodyEl.classList.remove('sp-anim');
        void bodyEl.offsetHeight;
        bodyEl.classList.add('sp-anim');
      }
    }
    window.addEventListener('gtr:shop-reset', onReset);
    return () => window.removeEventListener('gtr:shop-reset', onReset);
  }, [bodyEl]);

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
    bodyEl?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="sp-page-bg">
    <div id="sp-body" ref={setBodyEl}>
      <div id="sp-head">
        <div id="sp-title-area">
          <h1 id="sp-page-title">{activeTab.titleKr}</h1>
          <p id="sp-page-subtitle">{activeTab.subtitleKr}</p>
        </div>

        <ShopFilterTabs active={filter} onChange={handleFilterChange} />
      </div>

      {/* 상품 그리드 */}
      {/* 카드 마운트 시점의 transitionDelay 를 고정하기 위해 isInitRef 를 렌더 중 read-only 로 사용 —
          state 로 전환하면 첫 렌더 420ms → 후속 렌더 0 으로 덮여 의도가 무너짐. */}
      {/* eslint-disable react-hooks/refs */}
      <div id="sp-grid">
        {items.map((product, i) => (
          <ShopCard
            key={product.slug}
            product={product}
            colIndex={i % COLS}
            isSubFilter={filter === 'sub'}
            scrollRoot={bodyEl}
            baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
            instant={!isInitRef.current}
          />
        ))}
      </div>
      {/* eslint-enable react-hooks/refs */}

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
    </div>
  );
}
