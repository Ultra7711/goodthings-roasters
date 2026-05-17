/* ══════════════════════════════════════════
   EventBanner — cafe-events overlay 형식 (S234 후속 재작성)

   059 모델:
   - 반응형 이미지 3종 (desktop/tablet/mobile) — <picture> 로 brk 분기.
     · tablet/mobile 빈 값 → desktop fallback.
   - custom_css_path 가 있으면 <link rel="stylesheet"> 로 주입 →
     운영자가 미리 제작한 텍스트·레이아웃 CSS 가 .ev-banner[data-event-id="{id}"]
     scope 안에서 동작.

   설계:
   - <picture> 가 brk srcset 처리 → next/image 자체 srcset 우회 (운영자
     이미지 그대로 사용).
   - desktop 이미지 빈 값이면 EventBanner 자체 렌더 skip (null 반환).
   - data-event-id 속성 부여 → 운영자 CSS 가 scope 지정 가능.
   ══════════════════════════════════════════ */

import type { CafeEvent } from '@/lib/cafeEvents';

type Props = { event: CafeEvent };

export default function EventBanner({ event }: Props) {
  const desktop = event.image_path_desktop;
  if (!desktop) return null;

  const tablet = event.image_path_tablet || desktop;
  const mobile = event.image_path_mobile || desktop;
  const alt = event.image_alt || '';

  return (
    <>
      {event.custom_css_path && (
        <link rel="stylesheet" href={event.custom_css_path} />
      )}
      <div className="ev-banner-bleed" data-event-id={event.id}>
        <div className="ev-banner">
          <picture className="ev-banner__media">
            <source media="(max-width: 767px)" srcSet={mobile} />
            <source media="(max-width: 1023px)" srcSet={tablet} />
            <img
              src={desktop}
              alt={alt}
              className="ev-banner__img"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>
      </div>
    </>
  );
}
