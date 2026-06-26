'use client';

import './ShopPage.css';
import '@/components/ui/PageTitle.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ShopFilterTabs from './ShopFilterTabs';
import ShopCard from './ShopCard';
import {
  FILTER_TABS,
  filterProducts,
  SP_PER_PAGE,
  SP_PER_PAGE_MOBILE,
  type FilterKey,
  type Product,
} from '@/lib/products';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useItemArrivalGuard } from '@/hooks/useItemArrivalGuard';

/* V2 §4.1 grid 컬럼 — sp-grid--bean / sp-grid--drip CSS grid-template-columns 와 동기.
   값 변경 시 ShopPage.css 의 grid 정의 + imgPriority 가드 (i < COLS_*) 동시 갱신 필요. */
const COLS_BEAN = 2;
const COLS_DRIP = 4;
const CARD_BASE_DELAY_INIT = 420; // 초기 로드: 탭(0.3s) 등장 후 카드 시작 (ms)
const HIGHLIGHT_MS = 6000;        // S311 D: 가시화(IO) 트리거 점멸 — 소거 전 점멸 3회 완료 보장
const VALID_FILTERS: FilterKey[] = ['all', 'bean', 'drip'];

function isValidFilter(v: string | null): v is FilterKey {
  return v !== null && (VALID_FILTERS as string[]).includes(v);
}

export default function ShopPage({ products }: { products: Product[] }) {
  const BEANS = products.filter((p) => p.category === 'Coffee Bean');
  const DRIPS = products.filter((p) => p.category === 'Drip Bag');
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL `?filter=` 파싱 — searchParams 가 바뀔 때마다 재평가.
  // CafeMenuPage 와 동일 패턴: page.tsx 의 server-side await searchParams 를 제거하고
  // client 에서 읽어 /shop 를 Static (○) 라우트로 전환. Router Cache + Activity 보존
  // 효과로 /menu 와 동일하게 "재진입 시 DOM 유지 · 연출 중복 없음" 동작 확보.
  const urlFilter = useMemo<FilterKey>(() => {
    const q = searchParams.get('filter');
    return isValidFilter(q) ? q : 'all';
  }, [searchParams]);

  const [filter, setFilter] = useState<FilterKey>(urlFilter);
  const [page, setPage] = useState(1);
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null);

  // highlight timeout 을 ref 로 관리해 연속 URL 변경 시 경합 방지
  const highlightTimeoutRef = useRef<number | null>(null);

  // Adjusting state during render — urlFilter 동기화.
  // React 19 권장 패턴: effect 대신 렌더 본문에서 이전 값과 비교 후 즉시 setState.
  // WHY: useEffect 는 paint 후 실행되어 URL 변경 시 구 필터로 한 프레임 렌더됨 (route change flash).
  // CafeMenuPage 의 `prevUrlFilter` 패턴과 동일.
  const [prevUrlFilter, setPrevUrlFilter] = useState(urlFilter);
  if (prevUrlFilter !== urlFilter) {
    setPrevUrlFilter(urlFilter);
    setFilter(urlFilter);
    setPage(1);
  }

  // 검색 결과 → /shop?item=<slug> shortcut 진입.
  // CafeMenuPage 의 ?item= 패턴과 동일 — 매칭 카드 페이지 계산 + highlightSlug 세팅.
  // null 초기값 — 첫 렌더에서도 ?item= 복구 로직을 한 번 타도록.
  const [prevSearchKey, setPrevSearchKey] = useState<string | null>(null);
  const searchKey = searchParams.toString();
  if (prevSearchKey !== searchKey) {
    setPrevSearchKey(searchKey);
    const targetSlug = searchParams.get('item');
    if (targetSlug) {
      const matched = products.find((p) => p.slug === targetSlug);
      if (matched) {
        // useMediaQuery 는 초기값 false → 첫 렌더에서 perPage 가 항상 데스크탑 값.
        // window.matchMedia 를 직접 읽어 실제 뷰포트 기준으로 페이지 계산.
        const perPageNow =
          typeof window !== 'undefined' && window.matchMedia('(max-width: 479px)').matches
            ? SP_PER_PAGE_MOBILE
            : SP_PER_PAGE;
        const listWithinFilter = filterProducts(products, urlFilter);
        let idx = listWithinFilter.findIndex((p) => p.slug === targetSlug);
        if (idx < 0) {
          // mismatch — all 로 fallback
          const listAll = filterProducts(products, 'all');
          idx = listAll.findIndex((p) => p.slug === targetSlug);
          if (idx >= 0) {
            setFilter('all');
            setPage(Math.floor(idx / perPageNow) + 1);
            setHighlightSlug(targetSlug);
          }
        } else {
          setPage(Math.floor(idx / perPageNow) + 1);
          setHighlightSlug(targetSlug);
        }
      }
    }
  }
  // body element — callback ref 로 받아 scrollRoot 전달 시 리렌더 트리거 보장
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  // 초기 진입 플래그 — 최초 마운트에만 true 여서 첫 카드 stagger 에 0.42s 의
  // baseDelay 가 붙는다 (탭 등장 0.4s 직후 카드가 따라오도록). 이후 필터 전환·
  // 헤더 Shop 재클릭(리셋) 에서는 false 로 유지되어 baseDelay 0 + col stagger 만 동작.
  // useRef 사용: render 중 읽히지만 setState-in-effect 룰과의 충돌을 피하기 위한 의도.
  const isInitRef = useRef(true);
  const shouldAnimateCardsRef = useRef(true);

  // 전체 상품 이미지 프리로드 — 최초 마운트에 1회.
  // 탭 전환 시 새 카드 mount 로 인한 이미지 로드 깜빡임 방지.
  // products 의존성 의도적 누락 — mount 시 한 번만 prefetch (이후 products 변경 시 재호출 불필요).
  useEffect(() => {
    products.forEach((p) => {
      p.images.forEach((im) => {
        if (im.src) {
          const img = new Image();
          img.src = im.src;
        }
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* 페이지 진입 연출 — bodyEl 이 붙는 순간 재생 + window 'gtr:route-change'
     event 로 재진입 감지.
     Next.js 16 + React 19 Activity 하에서 이 페이지는 다른 페이지로 이동 시
     `display:none` 으로 hidden + effect 가 defer 됨 (pathname deps 로 재실행 불가).
     Layout 의 NavigationVisibilityGate 가 발송하는 route-change event 로 재진입
     타이밍을 알 수 있음 → detail === '/shop' 에서만 재생.
     (DB-06 S72 측정: Activity preserve 확정 · pathname deps 실패 확인) */
  useEffect(() => {
    if (!bodyEl) return;
    const triggerAnim = () => {
      bodyEl.classList.remove('sp-anim');
      if (!isInitRef.current) bodyEl.classList.remove('sp-cards-entering');
      void bodyEl.offsetHeight;
      bodyEl.classList.add('sp-anim');
      if (!isInitRef.current) {
        shouldAnimateCardsRef.current = true;
        bodyEl.classList.add('sp-cards-entering');
        // (COLS-1)*70ms stagger + 600ms duration + buffer
        setTimeout(() => bodyEl.classList.remove('sp-cards-entering'), 840);
      }
      isInitRef.current = false;
    };
    // 초기 재생 — mount 시점에 이미 /shop 인 경우 (직접 진입)
    if (window.location.pathname === '/shop') triggerAnim();
    // 재진입 감지
    const onRouteChange = (e: Event) => {
      if ((e as CustomEvent<string>).detail === '/shop') triggerAnim();
    };
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, [bodyEl]);

  /* SiteHeader 의 Shop 링크를 /shop 내에서 클릭했을 때 발송되는
     'gtr:shop-reset' 이벤트 수신 → 스크롤 top + sp-anim 래퍼 리빌 재생만 수행.
     필터/페이지는 건드리지 않는다 — 필터가 바뀌면 카드가 remount 되며
     fade-in 재생이 겹쳐 "과한 연출" 로 보이기 때문. 동일 필터 재클릭과 동일한
     조용한 진입 느낌을 모든 경우에 유지. */
  useEffect(() => {
    function onReset() {
      setHighlightSlug(null);
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (bodyEl) {
        bodyEl.classList.remove('sp-anim');
        bodyEl.classList.remove('sp-cards-entering');
        void bodyEl.offsetHeight;
        bodyEl.classList.add('sp-anim');
        bodyEl.classList.add('sp-cards-entering');
        setTimeout(() => bodyEl.classList.remove('sp-cards-entering'), 840);
      }
      shouldAnimateCardsRef.current = true;
    }
    window.addEventListener('gtr:shop-reset', onReset);
    return () => window.removeEventListener('gtr:shop-reset', onReset);
  }, [bodyEl]);

  // highlight 자동 소거 — highlightSlug 가 새로 세팅될 때마다 이전 timer 초기화 후 재등록
  useEffect(() => {
    if (highlightSlug === null) return;
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightSlug(null);
      highlightTimeoutRef.current = null;
    }, HIGHLIGHT_MS);
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [highlightSlug]);

  // S334: ?item= 진입 "푸터 먼저 노출 + 빈페이지" race 차단 (CafeMenuPage 와 공통 가드).
  useItemArrivalGuard('/shop');

  const isMobile = useMediaQuery('(max-width: 479px)');
  const perPage = isMobile ? SP_PER_PAGE_MOBILE : SP_PER_PAGE;
  /* V2 §4 — row 분리 후 카드는 row 안에서 모두 노출. 페이지네이션은 totalPages>1
     일 때만 등장 → SKU 6종 / perPage 20·10 에서 자연 비활성. SKU 확장 시 row × 페이지
     인터랙션 별도 PR 재설계 (carry-over). */
  const filteredCount = filterProducts(products, filter).length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / perPage));
  const currentPage = Math.min(page, totalPages);

  const showBean = filter === 'all' || filter === 'bean';
  const showDrip = filter === 'all' || filter === 'drip';

  const activeTab = FILTER_TABS.find((t) => t.key === filter) ?? FILTER_TABS[0];

  function handleFilterChange(key: FilterKey) {
    shouldAnimateCardsRef.current = false;
    setFilter(key);
    setPage(1);
    // URL에 필터를 반영 — 상품 상세 진입 후 뒤로 돌아올 때 탭 상태 유지
    router.replace(key === 'all' ? '/shop' : `/shop?filter=${key}`);
  }

  function handlePageChange(next: number) {
    shouldAnimateCardsRef.current = false;
    setPage(next);
    bodyEl?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="sp-page-bg">
    <div id="sp-body" ref={setBodyEl}>
      <div id="sp-head">
        <div id="sp-title-area" className="page-title-area">
          <h1 id="sp-page-title" className="page-title">{activeTab.titleKr}</h1>
          <p id="sp-page-subtitle" className="page-subtitle">천천히, 제대로 만듭니다.</p>
        </div>

        <ShopFilterTabs active={filter} onChange={handleFilterChange} />
      </div>

      {/* V2 §4.1 — 카테고리 분리 row.
          전체 탭: 두 row 모두 / 원두·드립백 탭: 단일 row.
          eyebrow 에 SKU 카운트 정직 노출 (자문 §4.1 핵심 시그널). H2 는 페이지 H1 과 중복이라 폐기.
          isInitRef 를 렌더 중 read-only 로 사용 — state 전환 시 첫 렌더 420ms → 후속 0 으로 덮여 의도가 무너짐. */}
      {/* eslint-disable react-hooks/refs */}
      <div id="sp-rows">
        {showBean && (
          <section className="sp-row" data-kind="bean">
            <header className={`sp-row-header${isInitRef.current ? ' sp-row-header--enter' : ''}`}>
              <span className="sp-row-eyebrow">Coffee Beans</span>
            </header>
            <div className="sp-grid sp-grid--bean">
              {BEANS.map((p, i) => (
                <ShopCard
                  key={p.slug}
                  product={p}
                  colIndex={i % COLS_BEAN}
                  scrollRoot={bodyEl}
                  baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
                  instant={!shouldAnimateCardsRef.current}
                  isHighlight={highlightSlug === p.slug}
                  aspect="5:4"
                  imgPriority={i < COLS_BEAN}
                />
              ))}
            </div>
          </section>
        )}
        {showDrip && (
          <section className="sp-row" data-kind="drip">
            <header className={`sp-row-header${isInitRef.current ? ' sp-row-header--enter' : ''}`}>
              <span className="sp-row-eyebrow">Drip Bag</span>
            </header>
            <div className="sp-grid sp-grid--drip">
              {DRIPS.map((p, i) => (
                <ShopCard
                  key={p.slug}
                  product={p}
                  colIndex={i % COLS_DRIP}
                  scrollRoot={bodyEl}
                  baseDelay={isInitRef.current ? CARD_BASE_DELAY_INIT : 0}
                  instant={!shouldAnimateCardsRef.current}
                  isHighlight={highlightSlug === p.slug}
                  aspect="1:1"
                  imgPriority={i < COLS_DRIP}
                />
              ))}
            </div>
          </section>
        )}
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
