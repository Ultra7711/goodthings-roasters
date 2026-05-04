/* ══════════════════════════════════════════
   EventBanner — advisory-E §3.2 이벤트 row
   (S149 V2 §2.5 PR-1b)

   sand bg · 2-col (이미지 + 본문) · 3 brk.
   CTA null 시 2-col grid. CTA 있으면 body 하단에 렌더.
   ══════════════════════════════════════════ */

import Image from 'next/image';
import Link from 'next/link';
import type { CafeEvent } from '@/lib/cafeEvents';

type Props = { event: CafeEvent };

export default function EventBanner({ event }: Props) {
  return (
    <div className="ev-banner-bleed">
      <div className="ev-banner">
      {/* 이미지 — 1:1 정사각 (desktop/tablet) · 16:9 (mobile via CSS) */}
      {event.image_path ? (
        <div className="ev-banner__img">
          <Image
            src={event.image_path}
            alt={event.image_alt || event.h4}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 200px, 260px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div className="ev-banner__img" />
      )}

      {/* 본문 */}
      <div className="ev-banner__body">
        {event.eyebrow && (
          <div className="ev-banner__eyebrow">{event.eyebrow}</div>
        )}
        <h4 className="ev-banner__h4">{event.h4}</h4>
        {event.meta && (
          <div className="ev-banner__meta">{event.meta}</div>
        )}
        {event.description && (
          <p className="ev-banner__desc">{event.description}</p>
        )}
        {event.cta_target && (
          <Link className="ev-banner__cta" href={event.cta_target}>
            자세히 →
          </Link>
        )}
      </div>
      </div>
    </div>
  );
}
