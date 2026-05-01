/* ══════════════════════════════════════════
   GoodDaysSection (홈 모먼트 그리드)
   프로토타입 라인 945–950, 10797–10813 이식
   ──────────────────────────────────────────
   featured 1장 (grid-row:1/3) + normal 4장
   이미지 데이터: GD_IMAGES에서 picks 5장
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';

/* Link onClick — 메인→굿데이즈 ?img= 진입 시 cream→black 1단계 flash 차단.
   body.gd-route-transition 즉시 부여 → fixed 검정 오버레이 → Suspense fallback 검정 →
   라이트박스 검정으로 자연 전환. GoodDaysPage 마운트 시 클래스 제거. */
function handleMomentClick() {
  if (typeof document !== 'undefined') {
    document.body.classList.add('gd-route-transition');
  }
}

const GD_IMAGES = [
  { src: '/images/gallery/KakaoTalk_20260328_161956706_01.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_02.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_03.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_04.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_05.webp' },
];

const featured = GD_IMAGES.filter((img) => img.featured);
const normal   = GD_IMAGES.filter((img) => !img.featured);

const PICKS = [
  featured[0] ?? normal[0],
  normal[0]   ?? featured[1],
  normal[1]   ?? featured[2],
  normal[2]   ?? featured[3],
  normal[3]   ?? featured[4],
].filter(Boolean) as { src: string }[];

export default function GoodDaysSection() {
  return (
    <section className="blk blk--bg-secondary" data-header-theme="light">
      <div className="gooddays-sec">
        <div className="moments-grid" id="main-gd-grid">
          {PICKS.map((img) => (
            <Link
              key={img.src}
              href={`/gooddays?img=${encodeURIComponent(img.src)}`}
              className="moment-card sr-img"
              data-sr-toggle
              onClick={handleMomentClick}
            >
              <div
                className="moment-img"
                style={{ background: `url('${img.src}') center/cover no-repeat` }}
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
