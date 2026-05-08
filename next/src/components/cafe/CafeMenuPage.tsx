/* ══════════════════════════════════════════
   CafeMenuPage (RP-5)
   프로토타입 `#cafe-menu-page` 컨테이너 + 진입 연출 이식.
   - ShopPage 패턴 차용: bodyEl callback ref 로 `cm-anim` 클래스 토글,
     URL query (`?cat=<key>&item=<id>`) 로 초기 필터/타겟 복구.
   - urlFilter / target restore 모두 "adjusting state during render" 패턴으로
     effect-내-setState 규칙 위반 없이 prop → state 동기화.
   - likes 는 menuLikesStore 외부 store 로 격리 (S116). MenuLikeButton ·
     MenuCardBadges 가 자체 구독하므로 카드는 likes 를 모름. CafeMenuPage 는
     sort 결정 용도로만 sortCommitted 를 구독.
   ══════════════════════════════════════════ */

'use client';

import './CafeMenuPage.css';
import '@/components/ui/PageTitle.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CafeFilterTabs from './CafeFilterTabs';
import CafeMenuGrid from './CafeMenuGrid';
import CafeNutritionSheet from './CafeNutritionSheet';
import {
  CAFE_MENU,
  CAFE_FILTER_TABS,
  CM_PER_PAGE,
  CM_PER_PAGE_MOBILE,
  filterCafeMenu,
  isCafeFilterKey,
  sortCafeMenu,
  type CafeFilterKey,
  type CafeMenuItem,
} from '@/lib/cafeMenu';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  fetchMenuLikes,
  commitMenuRanksOnReentry,
  useMenuSortCommitted,
} from '@/lib/menuLikesStore';

const HIGHLIGHT_MS = 1500;
// ShopPage 와 동일 — 탭(0.3s) 등장 후 카드 시작, 진입 후엔 0
const CARD_BASE_DELAY_INIT = 420;

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

  // body element — callback ref 로 받아서 scrollRoot 전달 시 리렌더 트리거 보장
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);

  // highlight timeout 을 ref 로 관리해 연속 URL 변경 시 경합 방지
  const highlightTimeoutRef = useRef<number | null>(null);

  // 초기 진입 플래그 — useRef 사용: render 중 읽히지만 setState-in-effect 룰과의 충돌을
  // 피하기 위한 의도 (ShopPage 동일 패턴).
  const isInitRef = useRef(true);
  const shouldAnimateCardsRef = useRef(true);

  const isMobile = useMediaQuery('(max-width: 479px)');
  const perPage = isMobile ? CM_PER_PAGE_MOBILE : CM_PER_PAGE;

  /* sort 전용 store snapshot. 첫 마운트 시 빈 객체(NEW only sort), 재진입 시
     commitMenuRanksOnReentry() 가 갱신 → CafeMenuPage 리렌더 + 카드 재정렬.
     사용자 토글로는 절대 변동 없음. */
  const sortCommitted = useMenuSortCommitted();

  // ───────────────────────────────────────────
  // Adjusting state during render — urlFilter / searchParams prop 동기화
  // React 19 권장 패턴: effect 대신 렌더 본문에서 이전 값과 비교 후 즉시 setState.
  // WHY: useEffect 는 paint 후 실행되어 URL 변경 시 구 필터로 한 프레임 렌더됨 (route change flash).
  // 같은 렌더 사이클 내에서만 업데이트되므로 cascading 아님.
  // ───────────────────────────────────────────
  const [prevUrlFilter, setPrevUrlFilter] = useState(urlFilter);
  const searchKey = searchParams.toString();
  /* null 초기값 — 초기 렌더에서도 `?item=` 복구 로직을 한 번 타도록 한다.
     `useState(searchKey)` 로 초기화하면 검색 결과에서 `/menu?item=<id>` 로
     진입하는 "첫 번째 렌더" 에서 condition 이 이미 동일해 highlight 가 누락됨. */
  const [prevSearchKey, setPrevSearchKey] = useState<string | null>(null);

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
        /* useMediaQuery 는 초기값 false → 첫 렌더에서 perPage 가 항상 데스크탑 값.
           window.matchMedia 를 직접 읽어 실제 뷰포트 기준으로 페이지를 계산한다.
           SSR(window 미정의) 에서는 데스크탑 fallback 사용 — 어차피 서버엔 스크롤 없음. */
        const perPageNow = typeof window !== 'undefined' && window.matchMedia('(max-width: 479px)').matches
          ? CM_PER_PAGE_MOBILE
          : CM_PER_PAGE;
        const listWithinFilter = sortCafeMenu(filterCafeMenu(CAFE_MENU, urlFilter));
        let idx = listWithinFilter.findIndex((i) => i.id === targetId);
        if (idx < 0) {
          // mismatch — all 로 fallback
          const listAll = sortCafeMenu(filterCafeMenu(CAFE_MENU, 'all'));
          idx = listAll.findIndex((i) => i.id === targetId);
          if (idx >= 0) {
            setFilter('all');
            setPage(Math.floor(idx / perPageNow) + 1);
            setHighlightId(targetId);
          }
        } else {
          setPage(Math.floor(idx / perPageNow) + 1);
          setHighlightId(targetId);
        }
      }
    }
  }

  // 마운트 시 likes 1회 fetch (store 내부에 fetched 가드 있음 → 중복 호출 안전)
  useEffect(() => {
    void fetchMenuLikes();
  }, []);

  // 전체 메뉴 이미지 프리로드 — 최초 마운트에 1회.
  // 탭 전환 시 새로 mount 되는 카드가 네트워크에서 이미지를 받느라 배경색만 잠깐
  // 보이는 깜빡임 방지. 브라우저 캐시에 올려두면 이후 탭 전환은 즉시 표시됨.
  useEffect(() => {
    CAFE_MENU.forEach((item) => {
      if (item.img) {
        const img = new Image();
        img.src = item.img;
      }
    });
  }, []);

  /* 페이지 진입 연출 — ShopPage 와 동등 패턴.
     - 초기 로드: cm-cards-entering 없음. IO + transitionDelay 만으로 stagger.
     - 재진입(gtr:route-change): cm-cards-entering 키프레임 추가 + commit. */
  useEffect(() => {
    if (!bodyEl) return;
    const triggerAnim = () => {
      bodyEl.classList.remove('cm-anim');
      if (!isInitRef.current) bodyEl.classList.remove('cm-cards-entering');
      void bodyEl.offsetHeight;
      bodyEl.classList.add('cm-anim');
      if (!isInitRef.current) {
        shouldAnimateCardsRef.current = true;
        commitMenuRanksOnReentry(); // 재진입 시 sort + 뱃지 그 시점 popular 으로
        bodyEl.classList.add('cm-cards-entering');
        // (COLS-1)*70ms stagger + 600ms duration + buffer
        setTimeout(() => bodyEl.classList.remove('cm-cards-entering'), 840);
      }
      isInitRef.current = false;
    };
    // 초기 재생 — mount 시점에 이미 /menu 인 경우 (직접 진입)
    if (window.location.pathname === '/menu') triggerAnim();
    // 재진입 감지
    const onRouteChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === '/menu') triggerAnim();
    };
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, [bodyEl]);

  /* SiteHeader 의 Menu 링크를 /menu 내에서 클릭했을 때 발송되는
     'gtr:menu-reset' 이벤트 수신 → 스크롤 top + cm-anim 래퍼 리빌 재생만 수행.
     필터/페이지는 건드리지 않는다 — 필터가 바뀌면 카드가 remount 되며
     fade-in 재생이 겹쳐 "과한 연출" 로 보이기 때문. 열려있는 영양정보 시트와
     하이라이트는 진입 초기 상태로 돌리기 위해 정리. (ShopPage 와 동일 패턴) */
  useEffect(() => {
    function onReset() {
      setNutriId(null);
      setHighlightId(null);
      commitMenuRanksOnReentry(); // reset 시점에 인기 sort + 뱃지 반영
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (bodyEl) {
        bodyEl.classList.remove('cm-anim');
        bodyEl.classList.remove('cm-cards-entering');
        void bodyEl.offsetHeight;
        bodyEl.classList.add('cm-anim');
        bodyEl.classList.add('cm-cards-entering');
        setTimeout(() => bodyEl.classList.remove('cm-cards-entering'), 840);
      }
      shouldAnimateCardsRef.current = true;
    }
    window.addEventListener('gtr:menu-reset', onReset);
    return () => window.removeEventListener('gtr:menu-reset', onReset);
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

  // 필터/페이징 — sortCommitted (store) 기반. 첫 마운트 시 빈 객체 = NEW only,
  // 재진입 시 commitMenuRanksOnReentry → sortCommitted 변경 → 재정렬.
  const filtered: CafeMenuItem[] = useMemo(() => {
    const popularIds = new Set(Object.keys(sortCommitted));
    return sortCafeMenu(filterCafeMenu(CAFE_MENU, filter), popularIds);
  }, [filter, sortCommitted]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const items = filtered.slice(start, start + perPage);

  const activeTab =
    CAFE_FILTER_TABS.find((t) => t.key === filter) ?? CAFE_FILTER_TABS[0];

  const handleFilterChange = useCallback(
    (key: CafeFilterKey) => {
      if (key === filter) return;
      shouldAnimateCardsRef.current = false;
      setFilter(key);
      setPage(1);
      setNutriId(null);
    },
    [filter],
  );

  const handlePageChange = useCallback((next: number) => {
    shouldAnimateCardsRef.current = false;
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
        <div id="cm-title-area" className="page-title-area">
          <h1 id="cm-page-title" className="page-title">{activeTab.titleKr}</h1>
          <p className="page-subtitle">매장에서 직접 내리고, 직접 굽습니다.</p>
        </div>

        <CafeFilterTabs active={filter} onChange={handleFilterChange} />
      </div>

      {/* baseDelay 는 useRef 직접 read — ShopPage 패턴.
          첫 마운트 시 420ms, 이후엔 0. likes 비동기 리렌더가 inline style 을
          흔들지 않도록 likes 는 store 로 격리됨 (S116). */}
      {/* eslint-disable react-hooks/refs */}
      <CafeMenuGrid
        items={items}
        filterKey={filter}
        pageKey={currentPage}
        highlightId={highlightId}
        scrollRoot={bodyEl}
        baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
        instant={!shouldAnimateCardsRef.current}
        onOpenNutrition={handleOpenNutrition}
      />
      {/* eslint-enable react-hooks/refs */}

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
