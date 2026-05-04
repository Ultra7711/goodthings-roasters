/* ══════════════════════════════════════════
   CafeMenuSection — server component

   S146 PR-1: 시즌 배너 폐기 (advisory-A 시그니처 chapter 로 대체).
   - season 영역 DB row + 어드민 폼은 보존 (PR-2 carry-over)
   - 카테고리 카드 그리드만 표시
   ══════════════════════════════════════════ */

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
    <section className="blk blk--bg-secondary cafe-menu-blk" id="cafe-menu-blk" data-header-theme="light">
      {/* 블록 헤더 */}
      <div className="blk-header cafe-menu-header" data-sr-toggle>
        <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>CAFE MENU</span>
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
            data-gtr-tap
          >
            <div className="cat-card-clip">
              <div className="cat-img">
                <div className={`cat-img-inner ${cls}`} />
                <div className="cat-overlay">
                  <svg
                    className="cat-arrow"
                    viewBox="0 0 48 48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10,24h28" />
                    <path d="M24,10l14,14-14,14" />
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
