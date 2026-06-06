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

import Link from 'next/link';
import type { SignatureBanner } from '@/lib/banners';
import IframeBanner from './IframeBanner';
import './SignatureChapterView.css';

interface SignatureChapterViewProps {
  signature: SignatureBanner;
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
  /* S246 — LQIP base64 dataURL. 빈 값 fallback 은 desktop blur. */
  const blurDesktop = signature.image_blur_desktop;
  const blurTablet = signature.image_blur_tablet || blurDesktop;
  const blurMobile = signature.image_blur_mobile || blurDesktop;

  /* HTML fetch — 운영자 .html 파일은 Storage public URL (season-banners/signature/html/*).
     cache: 'no-store' — 운영자 admin 변경 시 즉시 반영 보장 (production HTML
     변경 빈도 낮고 ~10KB 라 부담 미미. revalidate+tag 캐싱은 dev 환경 stale 발견).
     실패 시 chapter 렌더 skip (graceful). */
  let html = '';
  try {
    const res = await fetch(signature.custom_html_path, { cache: 'no-store' });
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
    IMAGE_ALT: signature.image_alt,
  });

  const aspectDesktop = normalizeAspect(signature.aspect_desktop, '1320 / 600');
  const aspectTablet = normalizeAspect(signature.aspect_tablet, '1024 / 520');
  const aspectMobile = normalizeAspect(signature.aspect_mobile, '390 / 520');

  /* desktop max-height — viewport > 1440 일 때 iframe height cap (가로만 stretch).
     1440 viewport 의 desktop height = 1440 × (aspectY / aspectX). */
  const [dw, dh] = aspectDesktop.split(' / ').map(Number);
  const desktopMaxHeight = (1440 * dh) / dw;

  /* brk 별 aspect-ratio 컨테이너 쿼리 — 단일 chapter scope.
     S239: @media → @container 변경. .sig-bleed 가 container 등록 → 외부 wrapper
     width 기준 BP 분기 (외부 wrapper padding 영향 흡수). iframe 안 @container
     (banner-wrap container) 도 동일 width 기준 → 양쪽 BP 동시 매치. mismatch 0.
     iframe 의 default attribute height(150) 가 aspect-ratio 보다 우선 적용되는
     이슈 회피 위해 height: auto 명시.
     S241: desktop max-height 추가 — viewport > 1440 일 때 height cap (이미지 가로 stretch). */
  const inlineCss = `
    .sig-iframe {
      height: auto;
      aspect-ratio: ${aspectDesktop};
      max-height: ${desktopMaxHeight}px;
    }
    @container (max-width: 1023px) {
      .sig-iframe {
        aspect-ratio: ${aspectTablet};
        max-height: none;
      }
    }
    @container (max-width: 767px) {
      .sig-iframe {
        aspect-ratio: ${aspectMobile};
        max-height: none;
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
        /* S241: SRInitializer 의 useEffect 안 classList.add('sr--visible') 이
           Router Cache / bfcache restore 시점에 server HTML 과 어긋나는 dev-only
           race (S236 진단 · production 영향 0). React 에 mismatch 경고 무시 지시. */
        suppressHydrationWarning
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
          {/* sr-img — 부모 section 의 [data-sr] 와 함께 SRInitializer 가 sr--visible
              토글 시 opacity/blur fade-in. globals.css §스크롤 리빌 베이스 답습. */}
          <IframeBanner
            className="sig-iframe sr-img"
            srcDoc={filledHtml}
            title={signature.image_alt || '시그니처 섹션'}
          />
          {/* iframe(sandbox)은 내부 클릭을 자체 소비하므로 전체 클릭 영역을
              absolute Link 오버레이로 덮는다. 드립백 배너 → /shop. */}
          <Link
            href="/shop"
            className="sig-link-overlay"
            aria-label={signature.cta_text || '상품 보러 가기'}
          />
        </div>
      </section>
    </>
  );
}
