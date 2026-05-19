/* ══════════════════════════════════════════
   SignatureChapterView — server presentational (S237 iframe 모델 · 062)

   책임:
   - props 만 받아 시그니처 chapter 렌더 (DB fetch X)
   - 빈 상태 분기 (enabled · custom_html_path · image_path_desktop) 자체 처리
   - HTML fetch → placeholder 치환 → <iframe srcDoc sandbox="allow-same-origin">
   - brk 별 aspect-ratio 미디어 쿼리 (CSS specificity 평준화)
   - iframe inline height auto (default attribute 150 회피)

   사용처:
   1. SignatureChapter (메인 페이지) — fetchSiteSettings 후 호출
   2. /preview/signature (어드민 미리보기) — searchParams 파싱 후 호출

   답습 source:
   - EventBanner.tsx (cafe-events 060/061 iframe 모델)
   - DEC-22 외부 sand bg 융합 (body transparent)
   - DEC-23 placeholder 치환 4종

   참조: lib/siteSettings.ts SignatureSettingsSchema
   ══════════════════════════════════════════ */

import type { SignatureSettings } from '@/lib/siteSettings';
import IframeBanner from './IframeBanner';
import './SignatureChapterView.css';

interface SignatureChapterViewProps {
  signature: SignatureSettings;
}

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
    /* {{KEY}} 패턴 — 공백 허용 ({{ KEY }}). value 의 정규식 메타문자는 그대로
       (URL 문자) — replace second arg 가 함수 아닌 string 이므로 안전. */
    const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    out = out.replace(re, value);
  }
  return out;
}

export default async function SignatureChapterView({
  signature,
}: SignatureChapterViewProps) {
  /* 빈 상태 — chapter 자체 hide */
  if (!signature.enabled) return null;
  if (!signature.custom_html_path) return null;
  if (!signature.image_path_desktop) return null;

  const desktop = signature.image_path_desktop;
  const tablet = signature.image_path_tablet || desktop;
  const mobile = signature.image_path_mobile || desktop;

  /* HTML fetch — 운영자 .html 파일은 Storage public URL (season-banners/signature/html/*).
     실패 시 chapter 렌더 skip (graceful). */
  let html = '';
  try {
    const res = await fetch(signature.custom_html_path, {
      next: { revalidate: 3600, tags: ['signature-html'] },
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
    IMAGE_ALT: signature.image_alt,
  });

  const aspectDesktop = normalizeAspect(signature.aspect_desktop, '1320 / 600');
  const aspectTablet = normalizeAspect(signature.aspect_tablet, '1024 / 520');
  const aspectMobile = normalizeAspect(signature.aspect_mobile, '390 / 520');

  /* brk 별 aspect-ratio 컨테이너 쿼리 — 단일 chapter scope.
     S239: @media → @container 변경. .sig-bleed 가 container 등록 → 외부 wrapper
     width 기준 BP 분기 (외부 wrapper padding 영향 흡수). iframe 안 @container
     (banner-wrap container) 도 동일 width 기준 → 양쪽 BP 동시 매치. mismatch 0.
     iframe 의 default attribute height(150) 가 aspect-ratio 보다 우선 적용되는
     이슈 회피 위해 height: auto 명시. */
  const inlineCss = `
    .sig-iframe {
      height: auto;
      aspect-ratio: ${aspectDesktop};
    }
    @container (max-width: 1023px) {
      .sig-iframe {
        aspect-ratio: ${aspectTablet};
      }
    }
    @container (max-width: 767px) {
      .sig-iframe {
        aspect-ratio: ${aspectMobile};
      }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: inlineCss }} />
      <section
        className="blk sig-section"
        data-header-theme="light"
        data-sr
      >
        {/* SEO/a11y 메타 텍스트 — iframe srcDoc 안 텍스트는 별도 document 라
            검색엔진/스크린리더 진입이 약함. iframe 외부에 sr-only 로 동일 텍스트
            제공해 인덱싱·낭독 회수. 시각 사용자는 iframe 안 디자인만 본다. */}
        {(signature.headline_text || signature.subhead_text || signature.cta_text) && (
          <div className="sr-only">
            {signature.headline_text && <h2>{signature.headline_text}</h2>}
            {signature.subhead_text && <p>{signature.subhead_text}</p>}
            {signature.cta_text && (
              signature.cta_href
                ? <a href={signature.cta_href}>{signature.cta_text}</a>
                : <span>{signature.cta_text}</span>
            )}
          </div>
        )}
        <div className="sig-bleed">
          <IframeBanner
            className="sig-iframe"
            srcDoc={filledHtml}
            title={signature.image_alt || '시그니처 섹션'}
          />
        </div>
      </section>
    </>
  );
}
