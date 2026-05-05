/* ══════════════════════════════════════════
   StoryChapter (V2 §2.6 — Story + GoodDays Cream → Dark)
   - Stage 1 (cream): The Story 텍스트 + 좌측 이미지 (PhilSection 흡수)
   - Stage 2 (dark · --ink-section): GOOD DAYS eyebrow + h "좋은 순간들" + 4컷 그리드
   - 한 chapter 묶음 — Hero(dark) → Sand → Cream → 본 chapter cream→dark → Footer 흐름 정리
   - cream flash (S122) 차단: 부모 사전 칠하기 — Stage 2 wrapper 자체가 dark bg
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';

/* 메인 → 굿데이즈 ?img= 진입 시 cream→black 1단계 flash 차단.
   body.gd-route-transition → fixed 검정 오버레이 → Suspense fallback 검정 →
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
];

export default function StoryChapter() {
  return (
    <section className="blk story-chapter" data-header-theme="light">
      {/* Stage 1 — cream · 텍스트 + 이미지 */}
      <div className="story-stage story-stage--cream" data-header-theme="light" data-sr-toggle>
        <div className="story-stage__inner">
          <div className="story-img sr-img">
            <div className="story-img__inner" />
          </div>
          <div className="story-txt">
            <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>The Story</span>
            <h2 className="story-h sr-txt sr-txt--d2">
              <span className="story-h__line">좋은 것에는</span>
              <span className="story-h__line story-h__line--bold">시간이 필요합니다</span>
            </h2>
            <p className="story-body sr-txt sr-txt--d3">
              빠름보다 바름을 선택합니다.<br />
              정직한 로스팅, 일관된 품질, 그리고 진심.<br />
              그것이 굳띵즈가 지켜온 단 하나의 기준입니다.
            </p>
            <div className="sig-cta-row sr-txt sr-txt--d4">
              <Link href="/story" className="sig-cta" data-gtr-tap>
                스토리 보기
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stage 2 — dark · GoodDays 4컷 */}
      <div className="story-stage story-stage--dark" data-header-theme="dark" data-sr-toggle>
        <div className="story-stage__inner">
          <div className="story-gd__head">
            <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>GOOD DAYS</span>
            <h3 className="story-gd__h sr-txt sr-txt--d2">좋은 순간들</h3>
          </div>
          <div className="story-gd__grid">
            {GD_IMAGES.map((img) => (
              <Link
                key={img.src}
                href={`/gooddays?img=${encodeURIComponent(img.src)}`}
                className="story-gd__card sr-img"
                onClick={handleMomentClick}
              >
                <div
                  className="story-gd__img"
                  style={{ background: `url('${img.src}') center/cover no-repeat` }}
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
