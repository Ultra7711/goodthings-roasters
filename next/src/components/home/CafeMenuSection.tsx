/* ══════════════════════════════════════════
   CafeMenuSection — server component (S129 H-5)

   시즌 배너는 site_settings.season 에서 fetch.
   - enabled = false → 배너 자체 렌더 안 함 (다른 카드 그리드는 유지)
   - eyebrow / title / subtitle / cta_text / cta_link / image_path / image_alt 동적
   ══════════════════════════════════════════ */

import Image from 'next/image';
import Link from 'next/link';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';

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

export default async function CafeMenuSection() {
  const { season } = await fetchSiteSettings();

  return (
    <section className="blk blk--bg-secondary cafe-menu-blk" id="cafe-menu-blk" data-header-theme="light">
      {/* 시즌 배너 — site_settings.season.enabled */}
      {season.enabled && (
        <div className="season-banner-section" data-sr-toggle>
          <div className="season-banner">
            <div className="season-banner-img sr-img">
              <Image
                src={season.image_path}
                alt={season.image_alt}
                fill
                sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1440px) 55vw, 720px"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="season-txt">
              <div className="season-copy">
                <span className="season-tag sr-txt sr-txt--d1" data-sr-eyebrow>{season.eyebrow}</span>
                <span className="season-h ed-h2 sr-txt sr-txt--d2">{season.title}</span>
                <span className="season-desc sr-txt sr-txt--d3">{season.subtitle}</span>
              </div>
              <Link href={season.cta_link || '/menu'} className="season-cta sr-txt sr-txt--d4" data-gtr-tap>
                {season.cta_text || '시즌 메뉴 보기'}
              </Link>
            </div>
          </div>
        </div>
      )}

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
