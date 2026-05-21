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
  fetchMenuLikes,
  commitMenuRanksOnReentry,
  useMenuSortCommitted,
} from '@/lib/menuLikesStore';

// S216-D P5: 1500 → 3000. cm-thumb-flash animation 자체는 0.7s × 2 = 1.4s 로
// iteration count 가 자체 종료 → 시각적 부조화 없음. likes fetch (~1.4~1.7s) 후
// sortCommitted reorder 까지 scrollIntoView effect 가 추적 가능하도록 유지.
const HIGHLIGHT_MS = 3000;
// ShopPage 와 동일 — 탭(0.3s) 등장 후 카드 시작, 진입 후엔 0
const CARD_BASE_DELAY_INIT = 420;

type Props = { items: CafeMenuItem[] };

export default function CafeMenuPage({ items }: Props) {
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

  // 마운트 시 likes 1회 fetch (store 내부에 fetched 가드 있음 → 중복 호출 안전)
  // S245-P14: fetch 완료 후 commitMenuRanksOnReentry 호출 — 첫 진입부터 popular
  // 정렬(좋아요 1~3위 우선) 활성. 기존 정책은 재진입 시점만 commit → 첫 진입은
  // NEW only sort 였음. 사용자 의도 = 첫 진입부터 인기 정렬 보고 싶음.
  useEffect(() => {
    void fetchMenuLikes().then(() => {
      commitMenuRanksOnReentry();
    });
  }, []);

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
  useEffect(() => {
    items.forEach((item) => {
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

  // S216-D P5 (timing fix): likes fetch 완료 → sortCommitted 갱신 → 카드 reorder 시
  // highlighted card 가 viewport 밖으로 밀려 footer 가 노출되는 케이스 보정.
  // sortCommitted 변경마다 highlightId 카드 위치 재추적 + scrollIntoView 재실행.
  // GenericCard 의 useEffect 는 [isHighlight] dep 이라 reorder 감지 못 함.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.querySelector<HTMLElement>(`[data-cm-id="${CSS.escape(highlightId)}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, sortCommitted, page]);

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

  /* S245-P11 정정: 정렬 정책 = NEW → popular (좋아요 1~3위) → 시그니처 → cat 순.
     popularRanks = sortCommitted (menu_likes 카운트 자동 rank 1/2/3 매핑). */
  const filtered: CafeMenuItem[] = useMemo(() => {
    return sortCafeMenu(filterCafeMenu(items, filter), sortCommitted);
  }, [filter, sortCommitted, items]);

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
      {/* eslint-disable react-hooks/refs */}
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
