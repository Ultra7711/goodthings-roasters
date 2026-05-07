/* ══════════════════════════════════════════
   SignatureChapterView — server presentational (S148 PR-2 추가)

   책임:
   - props 만 받아 시그니처 chapter 렌더 (DB fetch X)
   - 빈 상태 분기 (enabled · image · product · lookup) 자체 처리
   - SR 마크업 (data-sr-toggle · sr-img · sr-txt) 보존 — IntersectionObserver 자연 토글

   사용처:
   1. SignatureChapter (메인 페이지) — fetchSiteSettings 후 호출
   2. /preview/signature (어드민 미리보기) — searchParams 파싱 후 호출

   참조:
   - memory/advisory_A_signature_raw.html
   - lib/siteSettings.ts SignatureSettingsSchema
   - lib/products.ts PRODUCTS
   ══════════════════════════════════════════ */

import Image from 'next/image';
import Link from 'next/link';
import type { SignatureSettings } from '@/lib/siteSettings';
import { PRODUCTS } from '@/lib/products';
import './SignatureChapterView.css';

interface SignatureChapterViewProps {
  signature: SignatureSettings;
}

export default function SignatureChapterView({
  signature,
}: SignatureChapterViewProps) {
  /* 빈 상태 1~3 — chapter 자체 hide */
  if (!signature.enabled) return null;
  if (!signature.image_path) return null;
  if (!signature.product_slug) return null;

  const product = PRODUCTS.find((p) => p.slug === signature.product_slug);
  if (!product) return null;

  /* 빈 상태 4~5 — fallback 으로 처리, chapter 는 표시 */
  const title = signature.title || product.name;
  const subtitle = signature.subtitle || product.desc.split('\n')[0];
  /* PDP chip 과 동일 데이터/스타일 — product.noteTags + noteTagsEn positional zip */
  const chipKo = product.noteTags.split(/\s*\|\s*/).filter(Boolean);
  const chipEn = product.noteTagsEn.split(/\s*\|\s*/).filter(Boolean);
  const href = `/shop/${product.slug}`;

  return (
    <section
      className="blk sig-section"
      data-header-theme="light"
      data-sr-toggle
    >
      <div className="sig-card">
        <div className="sig-text">
          <span
            className="blk-label sr-txt sr-txt--d1"
            data-sr-eyebrow
          >
            {signature.eyebrow}
          </span>
          <h2 className="sig-h2 sr-txt sr-txt--d2">{title}</h2>
          <p className="sig-body sr-txt sr-txt--d3">{subtitle}</p>
          {chipKo.length > 0 && (
            <div className="sig-chips sr-txt sr-txt--d4">
              {chipKo.map((ko, i) => (
                <span key={`${ko}-${i}`}>
                  {ko}
                  {chipEn[i] ? <span className="sig-chip-en">{chipEn[i]}</span> : null}
                </span>
              ))}
            </div>
          )}
          <div className="sig-cta-row sr-txt sr-txt--d4">
            <Link href={href} className="sig-cta" data-gtr-tap>
              상세 보기
            </Link>
          </div>
        </div>
        <Link
          href={href}
          className="sig-img sr-img"
          aria-label={`${title} 자세히 보기`}
          data-gtr-tap
        >
          <Image
            src={signature.image_path}
            alt={signature.image_alt || title}
            fill
            sizes="(max-width: 1023px) 100vw, 58vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
        </Link>
      </div>
    </section>
  );
}
