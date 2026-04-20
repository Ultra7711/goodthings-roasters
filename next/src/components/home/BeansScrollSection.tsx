/* ══════════════════════════════════════════
   BeansScrollSection (Featured Beans)
   프로토타입 .blk-scroll (라인 892–901) 이식
   ──────────────────────────────────────────
   드래그 스크롤 + EMA 속도 추적 + 카드 스냅 + 양 끝 바운스 + 드래그 저항
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PRODUCTS, type Product } from '@/lib/products';

const FEATURED = PRODUCTS.filter((p) => p.status !== '품절').slice(0, 8);
const FRICTION = 160;       // 관성 착지 마찰 계수 (프로토타입 동일)
const EDGE_FACTOR = 0.25;   // 양 끝 드래그 저항 비율

/* 프로토타입 라인 5292: 한글 이름만 추출 (영문 이후 제거) */
function krName(name: string) {
  return name.replace(/\s+[A-Z][a-z].*$/, '');
}

function BeanCard({ product }: { product: Product }) {
  const img = product.images[0];
  /* 프로토타입 라인 5281: bean-img-inner에 배경 이미지 직접 적용 (center/contain) */
  const innerBg = img?.src
    ? `${img.bg ?? '#ECEAE6'} url('${img.src}') center/contain no-repeat`
    : (img?.bg ?? 'var(--color-background-secondary)');

  return (
    <Link href={`/shop/${product.slug}`} className="bean-card">
      <div className="bean-img sr-img" style={{ background: img?.bg ?? 'var(--color-background-secondary)' }}>
        <div className="bean-img-inner" style={{ background: innerBg }} />
      </div>
      <div className="bean-info">
        <span className="bean-info-cat">{product.category}</span>
        <span className="bean-info-name">{krName(product.name)}</span>
      </div>
    </Link>
  );
}

export default function BeansScrollSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  /* 드래그 상태 — ref로 관리 (렌더 불필요) */
  const dragStartRef     = useRef<number | null>(null);
  const dragScrollStart  = useRef(0);
  const draggedRef       = useRef(false);
  const blockClickRef    = useRef(false);
  const velXRef          = useRef(0);
  const lastXRef         = useRef(0);
  const lastTRef         = useRef(0);
  const bounceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const N = FEATURED.length;

  function maxScroll() {
    const el = scrollRef.current;
    return el ? el.scrollWidth - el.offsetWidth : 0;
  }

  /* idx → scrollLeft (비율 기반) */
  function snapTarget(idx: number) {
    const max = maxScroll();
    if (N <= 1) return 0;
    return Math.round((idx / (N - 1)) * max);
  }

  /* 양 끝 바운스 애니메이션 */
  function bounce(dir: 'start' | 'end') {
    const el = scrollRef.current;
    if (!el) return;
    el.classList.remove('bounce-start', 'bounce-end');
    void el.offsetWidth; // reflow — 애니메이션 재시작
    el.classList.add(dir === 'start' ? 'bounce-start' : 'bounce-end');
    if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
    bounceTimerRef.current = setTimeout(() => {
      el.classList.remove('bounce-start', 'bounce-end');
    }, 600);
  }

  /* 스크롤 → 활성 도트 업데이트 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const pct = max > 0 ? el.scrollLeft / max : 0;
      setActiveDot(Math.round(pct * (N - 1)));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [N]);

  /* 드래그 mousemove / mouseup — document에 등록 (트랙 밖 드래그 대응) */
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragStartRef.current === null) return;
      const dx = e.pageX - dragStartRef.current;

      if (Math.abs(dx) > 4) {
        draggedRef.current = true;
        scrollRef.current?.classList.add('dragging');
      }
      if (Math.abs(dx) > 10) blockClickRef.current = true;

      if (draggedRef.current && scrollRef.current) {
        const now = performance.now();
        const dt = now - lastTRef.current;
        if (dt > 0) {
          /* EMA 속도 추적 — 마찰 예측 착지점 계산에 사용 */
          velXRef.current = velXRef.current * 0.6 + ((e.pageX - lastXRef.current) / dt) * 0.4;
        }
        lastXRef.current = e.pageX;
        lastTRef.current = now;

        const raw = dragScrollStart.current - dx;
        const max = maxScroll();
        /* 양 끝 드래그 저항 (rubber band) */
        if (raw < 0) scrollRef.current.scrollLeft = raw * EDGE_FACTOR;
        else if (raw > max) scrollRef.current.scrollLeft = max + (raw - max) * EDGE_FACTOR;
        else scrollRef.current.scrollLeft = raw;
      }
    }

    function onMouseUp() {
      if (dragStartRef.current === null) return;
      scrollRef.current?.classList.remove('dragging');

      if (draggedRef.current && scrollRef.current) {
        const max = maxScroll();
        /* 관성 착지 위치 예측 (속도 × 마찰계수) */
        const projected = Math.max(0, Math.min(max, scrollRef.current.scrollLeft - velXRef.current * FRICTION));

        if (projected <= 2) {
          bounce('start');
          scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (projected >= max - 2) {
          bounce('end');
          scrollRef.current.scrollTo({ left: max, behavior: 'smooth' });
        } else {
          /* 가장 가까운 카드로 스냅 */
          const ti = Math.round((projected / max) * (N - 1));
          scrollRef.current.scrollTo({ left: snapTarget(ti), behavior: 'smooth' });
        }
      }

      dragStartRef.current = null;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  // snapTarget / bounce는 N에만 의존 — exhaustive-deps 경고 의도적 억제
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    dragStartRef.current    = e.pageX;
    dragScrollStart.current = el.scrollLeft;
    draggedRef.current      = false;
    blockClickRef.current   = false;
    velXRef.current         = 0;
    lastXRef.current        = e.pageX;
    lastTRef.current        = performance.now();
  }

  /* 도트 클릭 → 해당 카드로 스냅 스크롤 */
  function scrollToDot(idx: number) {
    scrollRef.current?.scrollTo({ left: snapTarget(idx), behavior: 'smooth' });
  }

  return (
    <section className="blk blk-scroll beans-blk" data-header-theme="light">
      <div className="blk-header beans-header" data-sr-toggle>
        <span className="blk-label sr-txt sr-txt--d1">FEATURED BEANS</span>
        <span className="blk-heading sr-txt sr-txt--d2">집에서도, 같은 맛을.</span>
      </div>
      <div className="beans-sec" style={{ marginTop: '26px' }}>
        <div
          className="beans-scroll"
          id="beans-track"
          ref={scrollRef}
          data-sr-toggle
          onMouseDown={onMouseDown}
          /* capture 단계에서 클릭 차단 — 드래그 후 Link 내비게이션 방지 */
          onClickCapture={(e) => {
            if (blockClickRef.current) {
              blockClickRef.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {FEATURED.map((p) => (
            <BeanCard key={p.slug} product={p} />
          ))}
        </div>
        <div className="beans-dots" id="beans-dots">
          {Array.from({ length: N }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`beans-dot${i === activeDot ? ' active' : ''}`}
              onClick={() => scrollToDot(i)}
              aria-label={`${i + 1}번째 페이지`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
