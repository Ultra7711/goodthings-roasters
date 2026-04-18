/* ══════════════════════════════════════════
   CafeMenuSection
   프로토타입 #cafe-menu-blk (라인 818–876) 이식
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';

const CAT_CARDS = [
  {
    cat: 'brewing',
    cls: 'img-coffee',
    title: 'Coffee',
    desc: '직접 로스팅한 원두로 내리는 한 잔',
  },
  {
    cat: 'non-coffee',
    cls: 'img-beverage',
    title: 'Non Coffee',
    desc: '티, 에이드, 그리고 계절 음료',
  },
  {
    cat: 'dessert',
    cls: 'img-dessert',
    title: 'Dessert',
    desc: '매장에서 직접 굽는 빵과 디저트',
  },
] as const;

export default function CafeMenuSection() {
  return (
    <section className="blk blk--bg-secondary" id="cafe-menu-blk" data-header-theme="light" style={{ paddingBottom: '120px' }}>
      {/* 시즌 배너 */}
      <div className="season-banner-section" data-sr-toggle>
        <div className="season-banner">
          <div className="season-banner-img sr-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sections/img_season_banner.webp" alt="시즌 메뉴" />
          </div>
          <div className="season-txt">
            <div className="season-copy">
              <span className="season-tag sr-txt sr-txt--d1">2026 · SPRING</span>
              <span className="season-h sr-txt sr-txt--d2">봄, 한 잔의 여유.</span>
              <span className="season-desc sr-txt sr-txt--d3">벚꽃이 지기 전에 만나는 시즌 한정 메뉴</span>
            </div>
            <Link href="/menu?cat=signature" className="season-cta sr-txt sr-txt--d4">
              시즌 메뉴 보기
            </Link>
          </div>
        </div>
      </div>

      {/* 블록 헤더 */}
      <div className="blk-header" data-sr-toggle style={{ padding: '80px 60px 0' }}>
        <span className="blk-label sr-txt sr-txt--d1">CAFE MENU</span>
        <span className="blk-heading sr-txt sr-txt--d2">오늘, 매장에서.</span>
      </div>

      {/* 카테고리 카드 그리드 */}
      <div className="cat-grid">
        {CAT_CARDS.map(({ cat, cls, title, desc }) => (
          <Link
            key={cat}
            href={`/menu?cat=${cat}`}
            className="cat-card"
            data-sr-toggle
            data-cat={cat}
          >
            <div className="cat-card-clip">
              <div className="cat-img">
                <div className={`cat-img-inner ${cls}`} />
                <div className="cat-overlay">
                  <svg
                    className="cat-arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5,12h14" />
                    <path d="M12,5l7,7-7,7" />
                  </svg>
                  <div className="cat-title">{title}</div>
                  <div className="cat-desc">{desc}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
