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
import CafeNutritionSheet from './CafeNutritionSheet';
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
  const [nutriId, setNutriId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // 헤더 Menu 재클릭 시 진입 연출 재트리거용 카운터.
  // - CafeMenuCard key 에 포함되어 동일 filter 에서도 카드 remount → IntersectionObserver
  //   상태 초기화 + 등장 연출 재생
  // - 래퍼(cm-anim) 자체는 재생하지 않음 → 탭 전환과 동일한 속도감 유지
  // - SiteHeader 는 레이아웃 트리 외부에 있어 props 로 직접 연결 불가 → window 커스텀
  //   이벤트(`gtr:menu-reset`) 기반 브리지 사용 (ShopPage 와 동일한 패턴)
  const [resetTick, setResetTick] = useState(0);

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
    setNutriId(null);
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

  // 페이지 진입 연출 — bodyEl 이 붙는 순간 cm-anim 토글 (최초 마운트에만).
  // 헤더 Menu 재클릭 시엔 래퍼 연출을 재생하지 않고 카드만 remount 되도록 해
  // "탭 전환과 동일한 속도감"을 유지한다. (ShopPage 와 동일 패턴)
  useEffect(() => {
    if (!bodyEl) return;
    bodyEl.classList.remove('cm-anim');
    void bodyEl.offsetHeight;
    bodyEl.classList.add('cm-anim');
  }, [bodyEl]);

  /* SiteHeader 의 Menu 링크를 /menu 내에서 클릭했을 때 발송되는
     'gtr:menu-reset' 이벤트 수신 → 필터/페이지 초기화 + 스크롤 top + 카드 remount.
     SiteHeader 는 컴포넌트 트리 외부(레이아웃)에 있어 props 로 직접
     연결할 수 없으므로 window 커스텀 이벤트 기반 브리지를 사용.
     resetTick 은 CafeMenuCard key 에 포함되어 동일 filter 상태에서도 remount 강제.
     cm-anim 래퍼는 재생하지 않아 탭 전환과 동일한 타이밍으로 카드가 올라오게 한다. */
  useEffect(() => {
    function onReset() {
      setFilter('all');
      setPage(1);
      setNutriId(null);
      setHighlightId(null);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setResetTick((n) => n + 1);
    }
    window.addEventListener('gtr:menu-reset', onReset);
    return () => window.removeEventListener('gtr:menu-reset', onReset);
  }, []);

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
      setNutriId(null);
    },
    [filter],
  );

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
    setNutriId(null);
    // /menu 는 일반 라우트 — window 스크롤만 사용
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenNutrition = useCallback((id: string) => {
    setNutriId(id);
  }, []);

  const handleCloseNutrition = useCallback(() => {
    setNutriId(null);
  }, []);

  const nutriItem: CafeMenuItem | null = useMemo(
    () => (nutriId ? CAFE_MENU.find((i) => i.id === nutriId) ?? null : null),
    [nutriId],
  );

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
        resetTick={resetTick}
        highlightId={highlightId}
        scrollRoot={bodyEl}
        onOpenNutrition={handleOpenNutrition}
      />

      <CafeNutritionSheet item={nutriItem} onClose={handleCloseNutrition} />

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
