/* ══════════════════════════════════════════
   SearchResultCard
   SRP 결과 행 — product / cafe 두 kind 모두 렌더.
   - name 필드만 <mark> 하이라이트 (SRP UX 스펙).
   - 클릭 시 각 도메인 라우트로 네비게이션.
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import HighlightText from './HighlightText';
import type { SearchResult } from '@/lib/search/types';

type Props = {
  result: SearchResult;
};

export default function SearchResultCard({ result }: Props) {
  const router = useRouter();

  if (result.kind === 'product') {
    const p = result.item;
    const firstImg = p.images[0];
    const categoryLabel = p.category;
    const thumbBg = firstImg?.bg ?? 'var(--color-background-secondary)';

    const onClick = () => router.push(`/shop/${p.slug}`);
    const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <button
        type="button"
        className="search-result-item"
        onClick={onClick}
        onKeyDown={onKey}
        aria-label={`${p.name} 상품 페이지로 이동`}
      >
        <div className="search-result-thumb" style={{ background: thumbBg }}>
          {firstImg?.src && (
            <Image
              src={firstImg.src}
              alt=""
              width={100}
              height={100}
              className="search-result-thumb-inner"
              style={{ objectFit: 'contain' }}
            />
          )}
        </div>
        <div className="search-result-info">
          <div className="search-result-category">{categoryLabel}</div>
          <div className="search-result-name">
            <HighlightText text={p.name} spans={result.spans} field="name" />
          </div>
          <div className="search-result-price">{p.price}</div>
        </div>
      </button>
    );
  }

  // cafe
  const c = result.item;
  const onClick = () => router.push(`/menu?item=${encodeURIComponent(c.id)}`);
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  const priceLabel = c.price > 0 ? `${c.price.toLocaleString('ko-KR')}원` : '';
  const thumbBg = c.img
    ? `${c.bg || 'var(--color-background-secondary)'} url('${c.img}') center/cover no-repeat`
    : c.bg || 'var(--color-background-secondary)';

  return (
    <button
      type="button"
      className="search-result-item"
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={`${c.name} 카페 메뉴로 이동`}
    >
      <div className="search-result-thumb" style={{ background: thumbBg }} />
      <div className="search-result-info">
        <div className="search-result-category">Cafe Menu</div>
        <div className="search-result-name">
          <HighlightText text={c.name} spans={result.spans} field="name" />
        </div>
        {priceLabel && <div className="search-result-price">{priceLabel}</div>}
      </div>
    </button>
  );
}
