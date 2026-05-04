/* ══════════════════════════════════════════
   SignatureChapter — server component (S146 V2 §2.2 PR-1)

   Hero 직후 sand 단독 chapter (advisory-A pixel spec).
   - fetchSiteSettings.signature + PRODUCTS lookup
   - 빈 상태 분기: enabled · image · product · subtitle · chips
   - SR 통합 (CafeMenuSection 패턴 답습)
   - data-header-theme="light" (sand bg 위 dark text)
   - CTA = PDP 진입 ("상세 보기") · 사진 = PDP Link wrap (이중 진입 동기)
   - eyebrow 는 시스템 .blk-label 클래스 통일

   참조:
   - memory/advisory_A_signature_raw.html
   - lib/siteSettings.ts SignatureSettingsSchema
   - lib/products.ts PRODUCTS
   ══════════════════════════════════════════ */

import Image from 'next/image';
import Link from 'next/link';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import { PRODUCTS } from '@/lib/products';

export default async function SignatureChapter() {
  const { signature } = await fetchSiteSettings();

  /* 빈 상태 1~3 — chapter 자체 hide */
  if (!signature.enabled) return null;
  if (!signature.image_path) return null;
  if (!signature.product_slug) return null;

  const product = PRODUCTS.find((p) => p.slug === signature.product_slug);
  if (!product) return null;

  /* 빈 상태 4~5 — fallback 으로 처리, chapter 는 표시 */
  const title = signature.title || product.name;
  const subtitle = signature.subtitle || product.desc.split('\n')[0];
  const chips =
    signature.flavor_chips.length > 0
      ? signature.flavor_chips.slice(0, 3)
      : product.noteTags.split(' | ').slice(0, 3);
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
          {chips.length > 0 && (
            <div className="sig-chips sr-txt sr-txt--d4">
              {chips.map((c) => (
                <span key={c}>{c}</span>
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
