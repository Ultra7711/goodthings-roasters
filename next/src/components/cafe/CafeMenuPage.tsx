/* ══════════════════════════════════════════
   CafeMenuPage (RP-5)
   프로토타입 `#cafe-menu-page` 컨테이너 + 진입 연출 이식.
   - ShopPage 패턴 차용: bodyEl callback ref 로 `cm-anim` 클래스 토글,
     URL query (`?cat=<key>&item=<id>`) 로 초기 필터/타겟 복구.
   - urlFilter / target restore 모두 "adjusting state during render" 패턴으로
     effect-내-setState 규칙 위반 없이 prop → state 동기화.
   - likes 는 menuLikesStore 외부 store 로 격리 (S116). MenuLikeButton ·
     MenuCardBadges 가 자체 구독하므로 카드는 likes 를 모름.
   - S330: 정렬은 sortCafeMenu (NEW 상단 + 카테고리 순 + sort_order). 인기
     자동정렬 의존 제거 → 인기 rank 는 뱃지로만 표시
     (badgesCommitted · commitMenuRanksOnReentry 유지).
   ══════════════════════════════════════════ */

'use client';

import './CafeMenuPage.css';
import '@/components/ui/PageTitle.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CafeFilterTabs from './CafeFilterTabs';
import CafeMenuGrid from './CafeMenuGrid';
import CafeNutritionSheet from './CafeNutritionSheet';
import {
  CAFE_FILTER_TABS,
  CM_PER_PAGE_DESKTOP,
  CM_PER_PAGE_MOBILE,
  CM_PER_PAGE_TABLET,
  filterCafeMenu,
  isCafeFilterKey,
  sortCafeMenu,
  type CafeFilterKey,
  type CafeMenuItem,
} from '@/lib/cafeMenu';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  commitMenuRanksOnReentry,
  fetchMyMenuLikes,
  hydrateMenuLikesCounts,
} from '@/lib/menuLikesStore';

// S311 D: 3000 → 6000. 점멸이 가시화(IO) 시점에 시작되므로(GenericCard flashActive)
// scroll·likes fetch·로드 지연으로 가시화가 늦어도 점멸 3회(2.1s)가 끝나기 전에
// highlightId 가 소거되지 않도록 여유를 둔다.
const HIGHLIGHT_MS = 6000;
// ShopPage 와 동일 — 탭(0.3s) 등장 후 카드 시작, 진입 후엔 0
const CARD_BASE_DELAY_INIT = 420;

type Props = {
  items: CafeMenuItem[];
  /* S247 폴리싱: counts 만 SSR snapshot. liked 는 client useEffect 에서 fetch.
     counts 기반 popular 정렬·뱃지가 SSR 시점에 fix → 점프 0. */
  initialLikesCounts: Record<string, number>;
};

export default function CafeMenuPage({ items, initialLikesCounts }: Props) {
  /* S247: counts-only hydrate (1회). sortCommitted/badgesCommitted 모두 SSR
     popular 으로 fix → 카드 reorder/배지 점프 0. liked 는 아래 useEffect 에서
     client fetch 로 채워짐 (좋아요 표시만 약간 지연). */
  useState(() => {
    hydrateMenuLikesCounts(initialLikesCounts);
    return true;
  });

  /* S247: 로그인 사용자 liked 1회 client fetch. 정렬·뱃지는 이미 SSR 시점
     popular 으로 fix 되어 있어 liked 도착해도 변동 없음. */
  useEffect(() => {
    void fetchMyMenuLikes();
  }, []);

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

  /* S245-P12: BP 별 perPage — 그리드 col 수 정합 (마지막 줄 빈 자리 제거).
     - 모바일 (<480 · 2 col): 10 (5줄)
     - 태블릿 (480~1023 · 2 col): 20 (10줄)
     - 데스크탑 (≥1024 · 3 col): 24 (8줄) */
  const isMobile = useMediaQuery('(max-width: 479px)');
  const isTablet = useMediaQuery('(max-width: 1023px)');
  const perPage = isMobile
    ? CM_PER_PAGE_MOBILE
    : isTablet
      ? CM_PER_PAGE_TABLET
      : CM_PER_PAGE_DESKTOP;

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

  /* S245-P14: pathname in-render 비교 — gtr:route-change listener 가
     cacheComponents/Activity 환경에서 신뢰성 떨어질 때의 안전망.
     외부 → /menu 진입 (prev !== '/menu' && now === '/menu') 시 page 1 reset.
     hidden Activity 컴포넌트가 visible 전환 시 React 가 client component re-render
     하면서 pathname Context Provider 가 새 값 전달 → if 비교 통과. */
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (pathname === '/menu' && !searchParams.get('item')) {
      setPage(1);
    }
  }

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
      const matched = items.find((i) => i.id === targetId);
      if (matched) {
        /* useMediaQuery 는 초기값 false → 첫 렌더에서 perPage 가 항상 데스크탑 값.
           window.matchMedia 를 직접 읽어 실제 뷰포트 기준으로 페이지를 계산한다.
           SSR(window 미정의) 에서는 데스크탑 fallback 사용 — 어차피 서버엔 스크롤 없음.
           S245-P12: BP 별 분기 (perPage useMemo 와 동일 정책). */
        const perPageNow =
          typeof window !== 'undefined' &&
          window.matchMedia('(max-width: 479px)').matches
            ? CM_PER_PAGE_MOBILE
            : typeof window !== 'undefined' &&
                window.matchMedia('(max-width: 1023px)').matches
              ? CM_PER_PAGE_TABLET
              : CM_PER_PAGE_DESKTOP;
        const listWithinFilter = sortCafeMenu(filterCafeMenu(items, urlFilter));
        let idx = listWithinFilter.findIndex((i) => i.id === targetId);
        if (idx < 0) {
          // mismatch — all 로 fallback
          const listAll = sortCafeMenu(filterCafeMenu(items, 'all'));
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
    } else if (highlightId !== null) {
      // S217 회귀 fix — item 없는 재진입(매장 사진 전체보기 · SiteHeader Menu)
      // 시 직전 ?item= 진입의 highlightId 잔존 방지. Activity preserve +
      // useEffect cleanup 으로 HIGHLIGHT_MS timer 가 cancel 되어 자동 소거가
      // 멈춤 → 진입 시점에 명시적으로 정리.
      setHighlightId(null);
    }
  }

  /* S245-P20 Phase 1: client fetch /api/menu-likes 자동 호출 폐기 —
     SSR snapshot hydrate 가 그 자리 대체 (첫 렌더부터 popular 정렬 완성).
     재진입 시점은 gtr:route-change listener 안 commitMenuRanksOnReentry 가 처리.
     사용자 토글 후 sync 필요 시 toggleMenuLike 가 store optimistic update. */

  // S216-D P5: home → /menu?item= 진입 시 풋터 먼저 노출 버그 fix.
  // layout-level NavigationScrollReset 이 useLayoutEffect 로 scrollTo(0) 하지만
  // home 처럼 출발 scrollY 가 큰 경우 race 발생 (CafeMenuPage Suspense 마운트
  // 타이밍 + Activity preserve). 페이지 컨텍스트의 useLayoutEffect 로 paint 전
  // 한 번 더 강제 보정. ?item= 시 GenericCard scrollIntoView 가 0 에서 시작.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!searchParams.get('item')) return;
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    // 마운트 시 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전체 메뉴 이미지 프리로드 — 최초 마운트에 1회.
  // 탭 전환 시 새로 mount 되는 카드가 네트워크에서 이미지를 받느라 배경색만 잠깐
  // 보이는 깜빡임 방지. 브라우저 캐시에 올려두면 이후 탭 전환은 즉시 표시됨.
  // items 의존성 의도적 누락 — mount 시 한 번만 prefetch (이후 items 변경 시 재호출 불필요).
  useEffect(() => {
    items.forEach((item) => {
      if (item.img) {
        const img = new Image();
        img.src = item.img;
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        commitMenuRanksOnReentry(); // 재진입 시 인기 rank 뱃지를 그 시점 popular 으로 (S330: 정렬 무관)
        bodyEl.classList.add('cm-cards-entering');
        // (COLS-1)*70ms stagger + 600ms duration + buffer
        setTimeout(() => bodyEl.classList.remove('cm-cards-entering'), 840);
      }
      isInitRef.current = false;
    };
    // 초기 재생 — mount 시점에 이미 /menu 인 경우 (직접 진입)
    if (window.location.pathname === '/menu') triggerAnim();
    // 재진입 감지 — Activity preserve 로 unmount 안 되는 페이지의 effect 재실행
    // 대용. gtr:route-change 는 NavigationVisibilityGate 발송.
    const onRouteChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== '/menu') return;
      // S216-D P5 (모바일 재진입 fix): ?item= 숏컷 재진입 시 NavigationScrollReset
      // 후 잔존 scrollY 가 BFCache/Activity 로 복원되는 케이스 보정.
      // window.location.search 로 stale closure 회피.
      const params = new URLSearchParams(window.location.search);
      const hasItem = params.get('item');
      if (hasItem && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      // S245-P13: cacheComponents/Activity 환경에서 page state 잔존 방지.
      // 외부 → /menu 진입 시 page 1 로 reset. ?item= 일 때는 item 검색 로직이
      // page 를 자동 결정하므로 skip (덮어쓰기 방지).
      if (!hasItem) {
        setPage(1);
      }
      triggerAnim();
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
      commitMenuRanksOnReentry(); // reset 시점에 인기 rank 뱃지 반영 (S330: 정렬 무관)
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

  // highlightId / page 변경 시 해당 카드로 scrollIntoView (검색 결과 진입 보정).
  // S330: 정렬이 sortCommitted 무관해져 reorder 가 없으므로 dep 에서 sortCommitted 제거.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.querySelector<HTMLElement>(`[data-cm-id="${CSS.escape(highlightId)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, page]);

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

  /* S330: 정렬 정책 = 카테고리 순 + sort_order 단일. NEW·인기·시그니처는
     정렬 무관 (배지로만 표시) — sortCommitted 의존 제거. */
  const filtered: CafeMenuItem[] = useMemo(() => {
    return sortCafeMenu(filterCafeMenu(items, filter));
  }, [filter, items]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

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
    setNutriId(null);
    /* S293: scrollTo 를 setPage 보다 먼저 + instant. smooth + setPage 순서일 때
       페이지 4(마지막) 처럼 카드가 적어 새 docHeight 가 짧아지는 케이스에서
       진행 중인 smooth scroll 이 clamp → 상단 도달 실패. instant 로 즉시
       0 고정 후 state update → DOM 변경되어도 scrollY=0 유지. */
    window.scrollTo({ top: 0, behavior: 'instant' });
    setPage(next);
  }, []);

  const handleOpenNutrition = useCallback((id: string) => {
    setNutriId(id);
  }, []);

  const handleCloseNutrition = useCallback(() => {
    setNutriId(null);
  }, []);

  const nutriItem: CafeMenuItem | null = useMemo(
    () => (nutriId ? items.find((i) => i.id === nutriId) ?? null : null),
    [nutriId, items],
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
      { }
      <CafeMenuGrid
        items={pageItems}
        filterKey={filter}
        pageKey={currentPage}
        highlightId={highlightId}
        scrollRoot={bodyEl}
        baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
        instant={!shouldAnimateCardsRef.current}
        onOpenNutrition={handleOpenNutrition}
      />
      { }

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
