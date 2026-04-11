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
  const [activeVolIdx, setActiveVolIdx] = useState(0);
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

  // useCallback: useEffect(outside-click) 의존성 배열 안정화
  const closeQa = useCallback(() => {
    setQaOpen(false);
    setQaClosing(true);
    setQaBarText('빠른 추가');
    setActiveVolIdx(0);
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
    if (qaOpen || isSoldOut || !showQaBar) return;
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

        {/* 매진 뱃지는 하단 .sp-qa-bar--disabled("매진") 과 중복이라 Shop 카드에선
            생략. 뱃지 자체는 검색 결과 등 다른 컨텍스트에서 계속 사용. */}
        {p.status && !isSoldOut && (
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
                    className={`sp-qa-vol-btn${i === activeVolIdx ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setActiveVolIdx(i); }}
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
          <div className="sp-qa-bar sp-qa-bar--disabled" aria-disabled="true">
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
