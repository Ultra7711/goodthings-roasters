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
import IframeBanner from './IframeBanner';

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
  /* S246 — LQIP base64 dataURL. 빈 값 fallback 은 desktop blur. */
  const blurDesktop = event.image_blur_desktop;
  const blurTablet = event.image_blur_tablet || blurDesktop;
  const blurMobile = event.image_blur_mobile || blurDesktop;

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
    IMAGE_BLUR_DESKTOP: blurDesktop,
    IMAGE_BLUR_TABLET: blurTablet,
    IMAGE_BLUR_MOBILE: blurMobile,
    IMAGE_ALT: event.image_alt,
  });

  const aspectDesktop = normalizeAspect(event.aspect_desktop, '1320 / 480');
  const aspectTablet = normalizeAspect(event.aspect_tablet, '1024 / 400');
  const aspectMobile = normalizeAspect(event.aspect_mobile, '390 / 640');

  /* desktop max-height — viewport > 1440 일 때 iframe height cap (가로만 stretch).
     1440 viewport 의 desktop height = 1440 × (aspectY / aspectX). */
  const [dw, dh] = aspectDesktop.split(' / ').map(Number);
  const desktopMaxHeight = (1440 * dh) / dw;

  /* brk 별 aspect-ratio 컨테이너 쿼리 — data-event-id scope.
     S239: @media → @container 변경. .ev-banner-bleed 가 container 등록 → 외부
     wrapper width 기준 BP 분기. iframe 안 @container (banner-wrap container) 도
     동일 width 기준 → 양쪽 BP 동시 매치. mismatch 0.
     iframe 의 default attribute height(150) 가 aspect-ratio 보다 우선 적용되는
     이슈 회피 위해 height: auto 명시.
     S241: desktop max-height 추가 — viewport > 1440 일 때 height cap (이미지 가로 stretch). */
  const inlineCss = `
    .ev-banner-iframe[data-event-id="${event.id}"] {
      height: auto;
      aspect-ratio: ${aspectDesktop};
      max-height: ${desktopMaxHeight}px;
    }
    @container (max-width: 1023px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${aspectTablet};
        max-height: none;
      }
    }
    @container (max-width: 767px) {
      .ev-banner-iframe[data-event-id="${event.id}"] {
        aspect-ratio: ${aspectMobile};
        max-height: none;
      }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: inlineCss }} />
      {/* data-sr + 자식 sr-img — SRInitializer 가 sr--visible 토글 시 iframe
          opacity/blur fade-in (SignatureChapter 답습). */}
      <div className="ev-banner-bleed" data-sr>
        {/* SEO/a11y 메타 텍스트 — iframe srcDoc 안 텍스트는 별도 document 라
            검색엔진/스크린리더 진입이 약함. iframe 외부 sr-only 로 동일 텍스트
            제공해 인덱싱·낭독 회수. signature (063) 답습. */}
        {(event.headline_text || event.subhead_text || event.cta_text) && (
          <div className="sr-only">
            {event.headline_text && <h2>{event.headline_text}</h2>}
            {event.subhead_text && <p>{event.subhead_text}</p>}
            {event.cta_text && (
              event.cta_href
                ? <a href={event.cta_href}>{event.cta_text}</a>
                : <span>{event.cta_text}</span>
            )}
          </div>
        )}
        <div className="ev-banner">
          <IframeBanner
            className="ev-banner-iframe sr-img"
            data-event-id={event.id}
            srcDoc={filledHtml}
            title={event.image_alt || '카페 이벤트 배너'}
          />
        </div>
      </div>
    </>
  );
}
