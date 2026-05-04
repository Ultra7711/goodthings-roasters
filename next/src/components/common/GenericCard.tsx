/* ══════════════════════════════════════════
   GenericCard (V2 §6.2 통합 base)
   ShopCard · CafeMenuCard 공통 골격 추출.
   - 썸네일 + 좌상단/우상단/우하단 슬롯 + info(name+price)
   - 스크롤 reveal IO + stagger (70ms × colIndex + baseDelay)
   - highlight scrollIntoView (URL ?item= 진입 시)
   - variant prop 으로 prefix 선택 (sp-/cm-) — 점진적 CSS 마이그레이션 안전
   ══════════════════════════════════════════ */

'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { SCROLL_REVEAL_THRESHOLD } from '@/lib/constants';

const STAGGER_MS = 70;

type Variant = 'shop' | 'cafe';

type VariantClasses = {
  card: string;
  visible: string;
  highlight: string;
  thumb: string;
  img: string;
  info: string;
  name: string;
  price: string;
  delayVar: '--sp-card-delay' | '--cm-card-delay';
};

const VARIANT_CLASS: Record<Variant, VariantClasses> = {
  shop: {
    card: 'sp-card',
    visible: 'sp-visible',
    highlight: 'sp-card--highlight',
    thumb: 'sp-card-thumb',
    img: 'sp-card-img',
    info: 'sp-card-info',
    name: 'sp-card-name',
    price: 'sp-card-price',
    delayVar: '--sp-card-delay',
  },
  cafe: {
    card: 'cm-card',
    visible: 'cm-visible',
    highlight: 'cm-card--highlight',
    thumb: 'cm-card-thumb',
    img: 'cm-card-img',
    info: 'cm-card-info',
    name: 'cm-card-name',
    price: 'cm-card-price',
    delayVar: '--cm-card-delay',
  },
};

type ThumbAspect = '1:1' | '5:4';

type Props = {
  variant: Variant;

  /** 카드 클릭 핸들러 — 카드 전체 영역 한 번. info 영역 클릭도 동일 트리거 */
  onClick: () => void;
  /** 키보드 접근성용 — true 면 role=button + Enter/Space */
  asButton?: boolean;
  ariaLabel?: string;

  /** 썸네일 inner div 의 inline style — backgroundColor·backgroundImage 등 호출자 책임 */
  imgStyle: CSSProperties;

  /** 썸네일 가로:세로 비율 — V2 §2.3 원두 5:4 / 드립백 1:1. default 1:1 */
  thumbAspect?: ThumbAspect;

  /** 슬롯 — 카드별 부가 요소 주입 */
  badgeSlot?: ReactNode;       // 좌상단 (status badge)
  topRightSlot?: ReactNode;    // 우상단 (좋아요 등 — cafe 전용)
  bottomRightSlot?: ReactNode; // 우하단 (온도 뱃지 등 — cafe 전용)

  /** info */
  name: string;
  price: string;

  /** 스크롤 reveal */
  scrollRoot: HTMLElement | null;
  colIndex: number;
  baseDelay?: number;
  instant?: boolean;

  /** highlight (URL ?item= 진입) */
  isHighlight?: boolean;

  /** 데이터 속성 — debug · 외부 selector 용 */
  dataSlug?: string;
  dataCmId?: string;
};

export default function GenericCard({
  variant,
  onClick,
  asButton = false,
  ariaLabel,
  imgStyle,
  thumbAspect = '1:1',
  badgeSlot,
  topRightSlot,
  bottomRightSlot,
  name,
  price,
  scrollRoot,
  colIndex,
  baseDelay = 0,
  instant = false,
  isHighlight = false,
  dataSlug,
  dataCmId,
}: Props) {
  const [isVisible, setIsVisible] = useState(instant);
  const cardRef = useRef<HTMLDivElement>(null);

  const cls = VARIANT_CLASS[variant];

  // 스크롤 reveal — one-shot IO
  useEffect(() => {
    const el = cardRef.current;
    if (!el || isVisible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          io.disconnect();
        }
      },
      { root: scrollRoot, threshold: SCROLL_REVEAL_THRESHOLD },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, isVisible]);

  // highlight 시 카드 자체 scrollIntoView
  useEffect(() => {
    if (isHighlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlight]);

  const className = [
    cls.card,
    isVisible ? cls.visible : '',
    isHighlight ? cls.highlight : '',
  ]
    .filter(Boolean)
    .join(' ');

  const delay = `${baseDelay + colIndex * STAGGER_MS}ms`;

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        transitionDelay: delay,
        [cls.delayVar]: delay,
      } as CSSProperties}
      onClick={onClick}
      role={asButton ? 'button' : undefined}
      tabIndex={asButton ? 0 : undefined}
      onKeyDown={
        asButton
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={ariaLabel}
      data-slug={dataSlug}
      data-cm-id={dataCmId}
    >
      <div
        className={cls.thumb}
        style={thumbAspect === '5:4' ? { aspectRatio: '5 / 4' } : undefined}
      >
        <div className={cls.img} style={imgStyle} />
        {badgeSlot}
        {topRightSlot}
        {bottomRightSlot}
      </div>

      <div className={cls.info}>
        <p className={cls.name}>{name}</p>
        <p className={cls.price}>{price}</p>
      </div>
    </div>
  );
}
