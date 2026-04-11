/* ══════════════════════════════════════════
   CafeMenuPage (RP-5)
   프로토타입 `#cafe-menu-page` 컨테이너 + 진입 연출 이식.
   - ShopPage 패턴 차용: bodyEl callback ref 로 `cm-anim` 클래스 토글,
     URL query (`?cat=<key>&item=<id>`) 로 초기 필터/타겟 복구.
   - RP4-D2 와 달리 카페 메뉴는 장바구니 연결 없음 (매장 메뉴 전용).
   - urlFilter / target restore 모두 "adjusting state during render" 패턴으로
     effect-내-setState 규칙 위반 없이 prop → state 동기화.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CafeFilterTabs from './CafeFilterTabs';
import CafeMenuGrid from './CafeMenuGrid';
import {
  CAFE_MENU,
  CAFE_FILTER_TABS,
  CM_PER_PAGE,
  filterCafeMenu,
  isCafeFilterKey,
  sortCafeMenu,
  type CafeFilterKey,
  type CafeMenuItem,
} from '@/lib/cafeMenu';

const HIGHLIGHT_MS = 1500;

export default function CafeMenuPage() {
  const searchParams = useSearchParams();

  // URL `?cat=` 파싱 — searchParams 가 바뀔 때마다 재평가
  const urlFilter = useMemo<CafeFilterKey>(() => {
    const q = searchParams.get('cat');
    return isCafeFilterKey(q) ? q : 'all';
  }, [searchParams]);

  const [filter, setFilter] = useState<CafeFilterKey>(urlFilter);
  const [page, setPage] = useState(1);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // body element — callback ref 로 받아서 scrollRoot 전달 시 리렌더 트리거 보장
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);

  // highlight timeout 을 ref 로 관리해 연속 URL 변경 시 경합 방지
  const highlightTimeoutRef = useRef<number | null>(null);

  // ───────────────────────────────────────────
  // Adjusting state during render — urlFilter / searchParams prop 동기화
  // React 19 권장 패턴: effect 대신 렌더 본문에서 이전 값과 비교 후 즉시 setState.
  // 같은 렌더 사이클 내에서만 업데이트되므로 cascading 아님.
  // ───────────────────────────────────────────
  const [prevUrlFilter, setPrevUrlFilter] = useState(urlFilter);
  const searchKey = searchParams.toString();
  const [prevSearchKey, setPrevSearchKey] = useState(searchKey);

  if (prevUrlFilter !== urlFilter) {
    setPrevUrlFilter(urlFilter);
    setFilter(urlFilter);
    setPage(1);
    setActiveCardId(null);
  }

  if (prevSearchKey !== searchKey) {
    setPrevSearchKey(searchKey);
    // 타겟 아이템 복구 — ?item=<id>
    const targetId = searchParams.get('item');
    if (targetId) {
      const matched = CAFE_MENU.find((i) => i.id === targetId);
      if (matched) {
        const listWithinFilter = sortCafeMenu(filterCafeMenu(CAFE_MENU, urlFilter));
        let idx = listWithinFilter.findIndex((i) => i.id === targetId);
        if (idx < 0) {
          // mismatch — all 로 fallback
          const listAll = sortCafeMenu(filterCafeMenu(CAFE_MENU, 'all'));
          idx = listAll.findIndex((i) => i.id === targetId);
          if (idx >= 0) {
            setFilter('all');
            setPage(Math.floor(idx / CM_PER_PAGE) + 1);
            setHighlightId(targetId);
          }
        } else {
          setPage(Math.floor(idx / CM_PER_PAGE) + 1);
          setHighlightId(targetId);
        }
      }
    }
  }

  // 페이지 진입 연출 — bodyEl 이 붙는 순간 cm-anim 토글
  useEffect(() => {
    if (!bodyEl) return;
    bodyEl.classList.remove('cm-anim');
    void bodyEl.offsetHeight;
    bodyEl.classList.add('cm-anim');
  }, [bodyEl]);

  // highlight 자동 소거 — highlightId 가 새로 세팅될 때마다 이전 timer 초기화 후 재등록
  useEffect(() => {
    if (highlightId === null) return;
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightId(null);
      highlightTimeoutRef.current = null;
    }, HIGHLIGHT_MS);
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [highlightId]);

  // 필터/페이징 파생 상태
  const filtered: CafeMenuItem[] = useMemo(
    () => sortCafeMenu(filterCafeMenu(CAFE_MENU, filter)),
    [filter],
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / CM_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * CM_PER_PAGE;
  const items = filtered.slice(start, start + CM_PER_PAGE);

  const activeTab =
    CAFE_FILTER_TABS.find((t) => t.key === filter) ?? CAFE_FILTER_TABS[0];

  const handleFilterChange = useCallback(
    (key: CafeFilterKey) => {
      if (key === filter) return;
      setFilter(key);
      setPage(1);
      setActiveCardId(null);
    },
    [filter],
  );

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
    setActiveCardId(null);
    // /menu 는 일반 라우트 — window 스크롤만 사용
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCardToggle = useCallback((id: string) => {
    setActiveCardId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div id="cm-body" ref={setBodyEl}>
      <div id="cm-head">
        <div id="cm-title-area">
          <h1 id="cm-page-title">{activeTab.titleKr}</h1>
          <p className="page-subtitle">매장에서 직접 내리고, 직접 굽습니다</p>
        </div>

        <CafeFilterTabs active={filter} onChange={handleFilterChange} />
      </div>

      <CafeMenuGrid
        items={items}
        filterKey={filter}
        pageKey={currentPage}
        activeCardId={activeCardId}
        highlightId={highlightId}
        scrollRoot={bodyEl}
        onCardToggle={handleCardToggle}
      />

      {totalPages > 1 && (
        <div id="cm-pagination">
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
              aria-label={`${n} 페이지로 이동`}
              aria-current={n === currentPage ? 'page' : undefined}
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
