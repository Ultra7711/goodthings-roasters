/* ══════════════════════════════════════════
   EventBanner — cafe-events iframe HTML + placeholder 치환 (S234 후속 · 061)

   061 모델 자동화:
   - 운영자 HTML 안 placeholder ({{IMAGE_DESKTOP}} · {{IMAGE_TABLET}} ·
     {{IMAGE_MOBILE}} · {{IMAGE_ALT}}) 를 DB image_path_* + image_alt 로
     server-side 치환 후 <iframe srcDoc> 임베드.
   - tablet/mobile 빈 값 → desktop fallback.
   - sandbox="allow-same-origin" — script 차단 · same-origin (about:srcdoc).

   장점:
   - 운영자가 이미지만 어드민에서 교체하면 HTML 재업로드 불필요.
   - iframe srcDoc 으로 inline 임베드 → cross-origin 이슈 회피.
   ══════════════════════════════════════════ */

import type { CafeEvent } from '@/lib/cafeEvents';

type Props = { event: CafeEvent };

/** "W/H" / "W : H" / 공백 변형 → "W / H" 정규화. */
function normalizeAspect(s: string, fallback: string): string {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[/:]\s*(\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return fallback;
  return `${m[1]} / ${m[2]}`;
}

/** HTML 안 placeholder 를 실제 값으로 치환 (전역 치환). */
function substitutePlaceholders(
  html: string,
  replacements: Record<string, string>,
): string {
  let out = html;
  for (const [key, value] of Object.entries(replacements)) {
    /* {{KEY}} 패턴 — 공백 허용 ({{ KEY }}). 운영자 입력 안전.
       value 의 정규식 메타문자는 그대로 (URL 문자) — replace second arg 가 함수 아닌 string 이므로 안전. */
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    out = out.replace(re, value);
  }
  return out;
}

export default async function EventBanner({ event }: Props) {
  if (!event.custom_html_path || !event.image_path_desktop) return null;

  const desktop = event.image_path_desktop;
  const tablet = event.image_path_tablet || desktop;
  const mobile = event.image_path_mobile || desktop;

  /* HTML fetch — 운영자 .html 파일은 Storage public URL (cafe-events/html/*).
     실패 시 EventBanner 렌더 skip (graceful). */
  let html = '';
  try {
    const res = await fetch(event.custom_html_path, {
      next: { revalidate: 3600, tags: [`cafe-event-html:${event.id}`] },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const filledHtml = substitutePlaceholders(html, {
    IMAGE_DESKTOP: desktop,
    IMAGE_TABLET: tablet,
    IMAGE_MOBILE: mobile,
    IMAGE_ALT: event.image_alt,
  });

  const aspectDesktop = normalizeAspect(event.aspect_desktop, '1320 / 480');
  const aspectTablet = normalizeAspect(event.aspect_tablet, '1024 / 400');
  const aspectMobile = normalizeAspect(event.aspect_mobile, '390 / 640');

  /* brk 별 aspect-ratio 미디어 쿼리 — data-event-id scope. */
  const inlineCss = `
    .ev-banner-iframe[data-event-id="${event.id}"] {
      aspect-ratio: ${aspectDesktop};
    }
    @media (max-width: 1023px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${aspectTablet};
      }
    }
    @media (max-width: 767px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${aspectMobile};
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
            srcDoc={filledHtml}
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
