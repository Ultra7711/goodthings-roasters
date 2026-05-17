/* ══════════════════════════════════════════
   EventBanner — cafe-events iframe HTML 형식 (S234 후속 · 060 iframe 진화)

   060 모델:
   - 운영자가 제작한 단일 .html 파일을 Supabase Storage 에 업로드.
   - <iframe sandbox="allow-same-origin"> 으로 임베드 — script 차단 보안 격리.
   - brk 별 aspect-ratio (CSS 'W/H') 로 iframe 컨테이너 사이즈 결정.
   - 이미지·CSS·SVG·폰트 모두 운영자 HTML 안에서 처리.

   설계:
   - server component — 인라인 <style> 로 brk 별 aspect-ratio 미디어 쿼리 주입.
   - data-event-id 속성 부여 → 스타일 scope 지정.
   - allow-same-origin 만 부여 → script 실행 차단 + 외부 폰트 로딩 허용.
   ══════════════════════════════════════════ */

import type { CafeEvent } from '@/lib/cafeEvents';

type Props = { event: CafeEvent };

/** "W/H" / "W / H" / "W:H" 등을 CSS aspect-ratio 형식 "W / H" 로 정규화. */
function normalizeAspect(s: string, fallback: string): string {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return fallback;
  return `${m[1]} / ${m[2]}`;
}

export default function EventBanner({ event }: Props) {
  if (!event.custom_html_path) return null;

  const desktop = normalizeAspect(event.aspect_desktop, '1320 / 480');
  const tablet = normalizeAspect(event.aspect_tablet, '1024 / 400');
  const mobile = normalizeAspect(event.aspect_mobile, '390 / 640');

  /* brk 별 aspect-ratio 미디어 쿼리 — data-event-id scope.
     desktop 기본 + tablet (max 1023) + mobile (max 767). */
  const inlineCss = `
    .ev-banner-iframe[data-event-id="${event.id}"] {
      aspect-ratio: ${desktop};
    }
    @media (max-width: 1023px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${tablet};
      }
    }
    @media (max-width: 767px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${mobile};
      }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: inlineCss }} />
      <div className="ev-banner-bleed">
        <div className="ev-banner">
          <iframe
            className="ev-banner-iframe"
            data-event-id={event.id}
            src={event.custom_html_path}
            title={event.image_alt || '카페 이벤트 배너'}
            sandbox="allow-same-origin"
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{
              display: 'block',
              width: '100%',
              border: 0,
              background: 'transparent',
            }}
          />
        </div>
      </div>
    </>
  );
}
