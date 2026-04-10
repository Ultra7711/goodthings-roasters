/* ══════════════════════════════════════════
   BeansScrollSection (Featured Beans)
   프로토타입 .blk-scroll (라인 892–901) 이식
   ──────────────────────────────────────────
   드래그 스크롤 + 도트 네비게이션 포함
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PRODUCTS } from '@/lib/productData';
import type { Product } from '@/types/product';

const FEATURED = PRODUCTS.filter((p) => p.status !== '매진').slice(0, 8);

function BeanCard({ product }: { product: Product }) {
  const img = product.images[0];
  return (
    <Link href={`/shop/${product.slug}`} className="bean-card" data-sr>
      <div className="bean-img sr-img" style={{ background: img?.bg ?? 'var(--color-background-secondary)' }}>
        <div className="bean-img-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img.src} alt={product.name} className="pkg" />}
        </div>
      </div>
      <div className="bean-info">
        <span className="bean-info-cat">{product.category}</span>
        <span className="bean-info-name">{product.name.split(' ')[0]}</span>
      </div>
    </Link>
  );
}

export default function BeansScrollSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  /* 도트 개수: 카드 수 기반 (카드 폭 25vw 기준) */
  const dotCount = Math.max(1, Math.ceil(FEATURED.length / 3));

  /* 스크롤 → 활성 도트 업데이트 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const pct = el.scrollLeft / (el.scrollWidth - el.clientWidth || 1);
      setActiveDot(Math.round(pct * (dotCount - 1)));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [dotCount]);

  /* 드래그 스크롤 */
  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
    el.classList.add('dragging');
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }
  function onMouseUp() {
    isDragging.current = false;
    scrollRef.current?.classList.remove('dragging');
  }

  /* 도트 클릭 → 해당 위치로 스크롤 */
  function scrollToDot(idx: number) {
    const el = scrollRef.current;
    if (!el) return;
    const target = ((el.scrollWidth - el.clientWidth) * idx) / Math.max(1, dotCount - 1);
    el.scrollTo({ left: target, behavior: 'smooth' });
  }

  return (
    <section className="blk blk-scroll" data-header-theme="light" style={{ marginTop: '117px' }}>
      <div className="blk-header" data-sr style={{ padding: '0 60px 0' }}>
        <span className="blk-label sr-txt sr-txt--d1">FEATURED BEANS</span>
        <span className="blk-heading sr-txt sr-txt--d2">집에서도, 같은 맛을.</span>
      </div>
      <div className="beans-sec" style={{ marginTop: '26px' }}>
        <div
          className="beans-scroll"
          id="beans-track"
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {FEATURED.map((p) => (
            <BeanCard key={p.slug} product={p} />
          ))}
        </div>
        <div className="beans-dots" id="beans-dots">
          {Array.from({ length: dotCount }, (_, i) => (
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
