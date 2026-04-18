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
            <HighlightText text={extractKrName(p.name)} spans={result.spans} field="name" />
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
  /* 배경을 단일 shorthand 로 조립하면 img 필드에 따옴표 포함된 문자열이 들어올 경우
     CSS 속성 주입이 가능 (현재 데이터 정적이나 향후 Supabase 전환 대비).
     - encodeURI 로 공백·제어문자 인코딩
     - 결과를 double quote 로 감싸서 남은 single quote 를 리터럴로 처리
     - 남은 double quote 는 %22 치환 */
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
      className="search-result-item"
      onClick={onClick}
      onKeyDown={onKey}
      aria-label={`${c.name} 카페 메뉴로 이동`}
    >
      <div className="search-result-thumb" style={thumbStyle} />
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
