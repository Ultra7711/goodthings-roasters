'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Product, extractKrName, formatStartPrice } from '@/lib/products';
import { useCartStore } from '@/lib/store';

const HOVER_DELAY_MS = 400;
const QA_TEXT_DELAY_MS = 150;
const SCROLL_REVEAL_THRESHOLD = 0.15;

function getBadgeClass(status: string): string {
  switch (status) {
    case 'NEW':       return 'sp-card-badge badge-new';
    case '인기 NO.1': return 'sp-card-badge badge-pop-1 badge-kr';
    case '인기 NO.2': return 'sp-card-badge badge-pop-2 badge-kr';
    case '인기 NO.3': return 'sp-card-badge badge-pop-3 badge-kr';
    case '수량 한정':  return 'sp-card-badge badge-ltd badge-kr';
    case '매진':      return 'sp-card-badge badge-sold badge-kr';
    default:          return 'sp-card-badge';
  }
}

/** 첫 번째 가용(매진 아닌) 볼륨 인덱스 — 전부 매진이면 0 */
function findFirstAvailVolIdx(p: Product): number {
  const idx = p.volumes.findIndex((v) => !v.soldOut);
  return idx >= 0 ? idx : 0;
}

type Props = {
  product: Product;
  colIndex: number;   // 0~2, 스크롤 reveal stagger용
  isSubFilter: boolean;
  scrollRoot: HTMLElement | null;
  baseDelay?: number; // 초기 로드 시 추가 딜레이(ms) — 필터 전환 시는 0
};

export default function ShopCard({ product: p, colIndex, isSubFilter, scrollRoot, baseDelay = 0 }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [qaOpen, setQaOpen] = useState(false);
  const [qaClosing, setQaClosing] = useState(false);
  const [qaBarText, setQaBarText] = useState('빠른 추가');
  const [activeVolIdx, setActiveVolIdx] = useState(() => findFirstAvailVolIdx(p));
  const [visible, setVisible] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qaTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    if (qaTextTimerRef.current) { clearTimeout(qaTextTimerRef.current); qaTextTimerRef.current = null; }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  }

  // useCallback: useEffect(outside-click) 의존성 배열 안정화.
  // p 는 key 로 인한 remount 로 인스턴스당 안정적이므로 [] deps 유지.
  const closeQa = useCallback(() => {
    setQaOpen(false);
    setQaClosing(true);
    setQaBarText('빠른 추가');
    setActiveVolIdx(findFirstAvailVolIdx(p));
    clearTimers();
    // 250ms: bar 수축 완료 → closing 클래스 제거 → CSS base opacity:0으로 페이드 아웃
    closeTimerRef.current = setTimeout(() => setQaClosing(false), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스크롤 reveal — one-shot IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: scrollRoot, threshold: SCROLL_REVEAL_THRESHOLD },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, visible]);

  // qa 열릴 때 외부 클릭 감지
  useEffect(() => {
    if (!qaOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) closeQa();
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [qaOpen, closeQa]);

  // Unmount cleanup — resetTick 증가 또는 필터 전환 시 ShopCard 가 remount 되는데,
  // 이때 진행 중이던 hover/close 타이머가 unmounted 인스턴스에서 setState 를 호출하면
  // 메모리 leak + React warning 발생. 또한 momentum scroll 로 mouseleave 가 누락된
  // 케이스에서 bar inline style 이 다음 생애에 전파되지 않도록 명시적으로 초기화한다.
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      if (qaTextTimerRef.current) { clearTimeout(qaTextTimerRef.current); qaTextTimerRef.current = null; }
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    };
  }, []);

  const img = p.images[0];
  const isSoldOut = p.status === '매진';
  const isDripBag = p.category === 'Drip Bag';
  const showQaBar = !isSubFilter;
  const thumbStyle = `${img?.bg ?? '#f5f5f3'}${img?.src ? ` url('${img.src}') center/contain no-repeat` : ''}`;

  function getBar() {
    return cardRef.current?.querySelector<HTMLElement>('.sp-qa-bar') ?? null;
  }

  function openQa() {
    clearTimers();
    setQaOpen(true);
    // closeQa 중 남아 있을 수 있는 inline style 초기화 (opacity/pointer-events 모두)
    const bar = getBar();
    if (bar) {
      bar.style.transition = '';
      bar.style.opacity = '';
      bar.style.pointerEvents = '';
    }
    qaTextTimerRef.current = setTimeout(() => setQaBarText('장바구니에 담기'), QA_TEXT_DELAY_MS);
  }

  function handleMouseEnter() {
    // 매진 카드도 hover 시 바가 등장하도록 isSoldOut 분기 제거.
    // 매진 상태에서는 빠른 추가 기능(openQa) 만 동작하지 않으며,
    // 바 자체의 등장/퇴장 모션은 일반 카드와 동일하게 유지한다.
    if (qaOpen || !showQaBar) return;
    hoverTimerRef.current = setTimeout(() => {
      const bar = getBar();
      if (bar) {
        bar.style.opacity = '1';
        // 투명 상태의 pointer-events:none 해제 — hover 로 실제 보이는 동안만 클릭 가능
        bar.style.pointerEvents = 'auto';
      }
    }, HOVER_DELAY_MS);
  }

  function handleMouseLeave() {
    clearTimers();
    if (!qaOpen) {
      const bar = getBar();
      if (bar) {
        bar.style.opacity = '';
        bar.style.pointerEvents = '';
      }
    }
  }

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.sp-qa-content, .sp-qa-bar')) return;
    if (qaOpen) { closeQa(); return; }
    router.push(`/shop/${p.slug}`);
  }

  function handleBarClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!qaOpen) { openQa(); return; }

    const vol = p.volumes[activeVolIdx];
    if (vol?.soldOut) { closeQa(); return; }
    addItem({
      slug: p.slug,
      name: p.name,
      price: vol ? `${vol.price.toLocaleString('ko-KR')}원` : '',
      priceNum: vol?.price ?? 0,
      qty: 1,
      color: p.color,
      image: img?.src ?? null,
      category: p.category,
      volume: vol?.label ?? null,
    });
    closeQa();
  }

  return (
    <div
      ref={cardRef}
      className={`sp-card${visible ? ' sp-visible' : ''}${qaOpen ? ' sp-card--qa-open' : ''}${qaClosing ? ' sp-card--qa-closing' : ''}`}
      style={{ transitionDelay: `${baseDelay + colIndex * 70}ms` }}
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-slug={p.slug}
    >
      <div className="sp-card-thumb">
        {/* 이미지 줌 클리핑 전용 래퍼 — overflow:hidden을 여기서만 적용해
            backdrop-filter(.sp-qa-content)가 부모 overflow:hidden에 막히지 않도록 분리 */}
        <div className="sp-card-img-wrap">
          <div className="sp-card-img" style={{ background: thumbStyle }} />
        </div>

        {/* 매진 카드도 뱃지를 표시한다. 매진 바는 hover 시에만 등장하므로
            상시 표시되는 뱃지가 필요함 (매진 상태를 즉시 인지 가능하도록). */}
        {p.status && (
          <span className={getBadgeClass(p.status)}>
            {p.status === 'NEW' ? 'NEW' : p.status}
          </span>
        )}

        {/* Quick Add */}
        {showQaBar && !isSoldOut && (
          <>
            {/* backdropFilter를 inline style로 지정하는 이유:
                부모(.sp-card-thumb)에 overflow:hidden이 없어야 하지만, .sp-card-img-wrap이
                overflow:hidden을 사용하므로 backdrop-filter가 GPU compositor layer 충돌로
                CSS에서 동작하지 않음 → inline style로 강제 적용 (프로토타입 동일 패턴) */}
            <div
              className="sp-qa-content"
              style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="sp-qa-label">{isDripBag ? '품목' : '용량'}</p>
              <div className="sp-qa-vols">
                {p.volumes.map((vol, i) => (
                  <button
                    key={vol.label}
                    className={
                      'sp-qa-vol-btn' +
                      (i === activeVolIdx ? ' active' : '') +
                      (vol.soldOut ? ' sold-out' : '')
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (vol.soldOut) return;
                      setActiveVolIdx(i);
                    }}
                    disabled={vol.soldOut}
                    aria-disabled={vol.soldOut || undefined}
                    type="button"
                  >
                    {vol.label}
                  </button>
                ))}
              </div>
            </div>

            {/* sp-qa-bar: div으로 유지해야 내부 button(sp-qa-close) 사용 가능 — button-in-button 스펙 위반 방지 */}
            <div
              className="sp-qa-bar"
              role="button"
              tabIndex={0}
              onClick={handleBarClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBarClick(e as unknown as React.MouseEvent); }}
            >
              <span className="sp-qa-bar-text">{qaBarText}</span>
              <button
                className="sp-qa-close"
                aria-label="닫기"
                onClick={(e) => { e.stopPropagation(); closeQa(); }}
                type="button"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16,8l-8,8" /><path d="M8,8l8,8" />
                </svg>
              </button>
            </div>
          </>
        )}

        {isSoldOut && showQaBar && (
          <div
            className="sp-qa-bar sp-qa-bar--disabled"
            role="status"
            aria-label="매진"
          >
            <span className="sp-qa-bar-text">매진</span>
          </div>
        )}
      </div>

      <div className="sp-card-info">
        <p className="sp-card-name">{extractKrName(p.name)}</p>
        <p className="sp-card-price">{formatStartPrice(p)}</p>
      </div>
    </div>
  );
}
