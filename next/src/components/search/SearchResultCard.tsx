/* ══════════════════════════════════════════
   SearchResultCard (S199 V2 §6.9 — sp-card 답습 grid card)
   - product / cafe 두 kind 모두 sp-card-* 디자인 spec 사용 (ShopPage 정합)
   - HighlightText 보존 (검색어 <mark> 하이라이트)
   - 클릭: product → /shop?item=<slug> · cafe → /menu?item=<id>
   - sp-visible 항상 부여 (Shop IO 의존 X — 검색 페이지 즉시 노출)
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import HighlightText from './HighlightText';
import { extractKrName } from '@/lib/utils';
import type { SearchResult } from '@/lib/search/types';

type Props = {
  result: SearchResult;
};

export default function SearchResultCard({ result }: Props) {
  const router = useRouter();

  if (result.kind === 'product') {
    const p = result.item;
    const firstImg = p.images[0];
    const thumbBg = firstImg?.bg ?? 'var(--color-background-secondary)';

    // V2 §6.2 — PDP 직행이 아닌 /shop 페이지의 해당 카드로 shortcut.
    const onClick = () => router.push(`/shop?item=${encodeURIComponent(p.slug)}`);
    const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };

    return (
      <button
        type="button"
        className="sp-card sp-visible sr-card"
        onClick={onClick}
        onKeyDown={onKey}
        aria-label={`${p.name} 상품 페이지로 이동`}
      >
        <div className="sp-card-thumb" style={{ background: thumbBg }}>
          {firstImg?.src && (
            <Image
              src={firstImg.src}
              alt=""
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
              style={{ objectFit: 'contain' }}
            />
          )}
        </div>
        <div className="sp-card-info">
          <p className="sp-card-name">
            <HighlightText text={extractKrName(p.name)} spans={result.spans} field="name" />
          </p>
          <p className="sp-card-price">{p.price}</p>
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
  /* 배경 url 인젝션 가드 — 동적 데이터(향후 Supabase) 대비 encodeURI + " 치환 */
  const safeBgUrl = c.img
    ? `url("${encodeURI(c.img).replace(/"/g, '%22')}")`
    : undefined;
  const thumbStyle: React.CSSProperties = {
    backgroundColor: c.bg || 'var(--color-background-secondary)',
    ...(safeBgUrl && {
      backgroundImage: safeBgUrl,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }),
  };

  return (
    <button
      type="button"
      className="sp-card sp-visible sr-card"
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={`${c.name} 카페 메뉴로 이동`}
    >
      <div className="sp-card-thumb" style={thumbStyle} />
      <div className="sp-card-info">
        <p className="sp-card-name">
          <HighlightText text={c.name} spans={result.spans} field="name" />
        </p>
        {priceLabel && <p className="sp-card-price">{priceLabel}</p>}
      </div>
    </button>
  );
}
