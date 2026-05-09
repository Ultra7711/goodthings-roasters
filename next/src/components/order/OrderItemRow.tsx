/* ══════════════════════════════════════════
   OrderItemRow — 4종 (cart drawer / cart page / order complete / order summary)
   공통 아이템 라인 컴포넌트.

   설계 결정 (S201):
   - variant: editable | readonly
     · editable — 스텝퍼 + 삭제 버튼 노출 (cart drawer / cart page)
     · readonly — 수량을 meta inline 에 흡수 (order complete / order summary)
   - stepperSize: sm (32) | md (36) — 모바일 자동 lg (44, touch-friendly)
   - 라인 자체는 모든 해상도에서 1행 row 유지. ellipsis 로 좁은 화면 대응.
   - 텍스트 행간은 token (--space-1 = 4px) 으로 조화.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import { splitName, getSubscriptionBadge } from '@/lib/products';
import { formatPrice } from '@/lib/utils';
import './OrderItemRow.css';

export type OrderItemRowItem = {
  /** 풀 네임 (한/영 mix). splitName 으로 한국어 부분만 표시. */
  name: string;
  category?: string | null;
  volume?: string | null;
  /** 'subscription' | 'one-time' | 기타 — getSubscriptionBadge 로 라벨 변환 */
  type?: string | null;
  /** "4주" 등. type==='subscription' 일 때만 사용. */
  period?: string | null;
  qty: number;
  /** 단가 (lineTotal = priceNum × qty) */
  priceNum: number;
  image: {
    src?: string | null;
    /** 빈 배경 색 (img.bg fallback) */
    bg?: string | null;
  };
};

type OrderItemRowProps = {
  item: OrderItemRowItem;
  variant: 'editable' | 'readonly';
  showCategory?: boolean;
  /** editable 한정. default true. */
  showDelete?: boolean;
  /** 지정 시 thumb 가 Link 로 wrap (예: cart drawer/page → 상품 상세). */
  thumbHref?: string;
  /** thumb Link 클릭 시 부수효과 (예: drawer close). */
  onThumbClick?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onRemove?: () => void;
};

export default function OrderItemRow({
  item,
  variant,
  showCategory = true,
  showDelete = true,
  thumbHref,
  onThumbClick,
  onIncrement,
  onDecrement,
  onRemove,
}: OrderItemRowProps) {
  const { kr } = splitName(item.name);
  const subBadge = getSubscriptionBadge({
    type: item.type ?? '',
    period: item.period,
  });
  const lineTotal = item.priceNum * item.qty;

  // readonly = volume · subscription · {qty}개
  // editable = volume · subscription (qty 는 stepper 로 분리)
  const metaCore = [item.volume, subBadge].filter(Boolean) as string[];
  const metaParts =
    variant === 'readonly' ? [...metaCore, `${item.qty}개`] : metaCore;

  // thumb 본문 (img or empty fallback)
  const thumbContent = item.image.src ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={item.image.src} alt={item.name} />
  ) : (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      className="oir__thumb-empty"
      src="/images/icons/image_empty.svg"
      alt=""
      aria-hidden="true"
    />
  );
  // 썸네일 배경: 양쪽 variant 모두 #eaeaea 통일 (CSS 처리 — inline 미사용).
  // item.image.bg 는 데이터 보존만 하고 시각엔 미적용.

  return (
    <div className="oir" data-variant={variant}>
      {/* ── Thumb (Link or div) ── */}
      {thumbHref ? (
        <Link
          href={thumbHref}
          onClick={onThumbClick}
          className="oir__thumb"
          aria-label={`${item.name} 상세 보기`}
        >
          {thumbContent}
        </Link>
      ) : (
        <div className="oir__thumb">{thumbContent}</div>
      )}

      {/* ── Info column (flex:1) ── */}
      <div className="oir__info">
        {showCategory && item.category && (
          <div className="oir__category">{item.category}</div>
        )}
        <div className="oir__name">{kr}</div>
        {metaParts.length > 0 && (
          <div className="oir__meta">{metaParts.join(' · ')}</div>
        )}

        {variant === 'editable' && (
          <div className="oir__stepper" role="group" aria-label="수량">
            <button
              type="button"
              className="oir__stepper-btn"
              onClick={onDecrement}
              disabled={item.qty <= 1}
              aria-label="수량 감소"
            >
              <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true">
                <line
                  x1="3"
                  y1="7"
                  x2="11"
                  y2="7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>
            <span className="oir__stepper-num">{item.qty}</span>
            <button
              type="button"
              className="oir__stepper-btn"
              onClick={onIncrement}
              aria-label="수량 증가"
            >
              <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true">
                <line
                  x1="3"
                  y1="7"
                  x2="11"
                  y2="7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <line
                  x1="7"
                  y1="3"
                  x2="7"
                  y2="11"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Right column ── */}
      <div className="oir__right">
        {variant === 'editable' && showDelete && (
          <button
            type="button"
            className="oir__delete"
            onClick={onRemove}
            aria-label="상품 삭제"
            title="삭제"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10,11v6" />
              <path d="M14,11v6" />
              <path d="M19,6v14c0,1.1-.9,2-2,2H7c-1.1,0-2-.9-2-2V6" />
              <path d="M3,6h18" />
              <path d="M8,6v-2c0-1.1.9-2,2-2h4c1.1,0,2,.9,2,2v2" />
            </svg>
          </button>
        )}
        <div className="oir__price">{formatPrice(lineTotal)}</div>
      </div>
    </div>
  );
}
