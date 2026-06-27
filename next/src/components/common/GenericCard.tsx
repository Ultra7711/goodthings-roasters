/* ══════════════════════════════════════════
   GenericCard (V2 §6.2 통합 base)
   ShopCard · CafeMenuCard 공통 골격 추출.
   - 썸네일 + 좌상단/우상단/우하단 슬롯 + info(name+price)
   - 스크롤 reveal IO + stagger (70ms × colIndex + baseDelay)
   - highlight scrollIntoView (URL ?item= 진입 시)
   - variant prop 으로 prefix 선택 (sp-/cm-) — 점진적 CSS 마이그레이션 안전
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { SCROLL_REVEAL_THRESHOLD } from '@/lib/constants';
import { unlockItemArrival } from '@/hooks/useItemArrivalGuard';

const STAGGER_MS = 70;

type Variant = 'shop' | 'cafe';

type VariantClasses = {
  card: string;
  visible: string;
  highlight: string;
  flash: string;
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
    flash: 'sp-card--flash',
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
    flash: 'cm-card--flash',
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

  /** 카드 클릭 핸들러 — 썸네일 영역 한정. info(name/price) 영역은 클릭 비활성. */
  onClick: () => void;
  /** 키보드 접근성용 — true 면 role=button + Enter/Space */
  asButton?: boolean;
  ariaLabel?: string;

  /** 썸네일 이미지 src — next/image 사용 (S198 migration) */
  imgSrc?: string;
  imgAlt?: string;
  /** 이미지 object-fit — variant default: shop=contain, cafe=cover. 명시 시 override */
  imgFit?: 'contain' | 'cover';
  /** legacy: imgSrc 미제공 시 inline style fallback (마이그레이션 호환) */
  imgStyle?: CSSProperties;
  /** next/image priority — viewport above-fold 카드에 true (LCP 개선) */
  imgPriority?: boolean;
  /** S205: LQIP blurDataURL — 제공 시 placeholder='blur'. 미제공 시 placeholder='empty'. */
  imgBlurDataURL?: string;

  /** 썸네일 가로:세로 비율 — V2 §2.3 원두 5:4 / 드립백 1:1. default 1:1 */
  thumbAspect?: ThumbAspect;

  /** 슬롯 — 카드별 부가 요소 주입 */
  badgeSlot?: ReactNode;       // 좌상단 (status badge)
  topRightSlot?: ReactNode;    // 우상단 (cafe 좋아요)
  bottomRightSlot?: ReactNode; // 우하단 (현재 미사용 · P20 재설계로 폐기)

  /** info — string 또는 ReactNode (cafe 시그니처 메뉴는 SVG prefix 포함) */
  name: string | ReactNode;
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
  imgSrc,
  imgAlt,
  imgFit,
  imgStyle,
  imgPriority = false,
  imgBlurDataURL,
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
  /* S311 D / S340: 점멸은 "아이템 도착(arrived) + 썸네일 이미지 로드(imgReady)" 둘 다
     충족 시 시작하는 파생 값(flashActive, 아래). 로딩 지연 중 점멸이 소진돼 인지
     실패하던 문제(이미지가 뜨기 전 점멸이 지나가버림)를 해결. */
  const [arrived, setArrived] = useState(false);
  /* 이미지 없는 카드(placeholder div)는 로드 대기 없이 즉시 ready. */
  const [imgReady, setImgReady] = useState(!imgSrc);
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

  // highlight 시 카드 자체 scrollIntoView — 타겟 카드 "도착" 시점.
  // scrollTo(0) 먼저 — 다른 페이지에서 ?item= 진입 시 브라우저가 이전 스크롤 위치를
  // 그대로 유지하는 경우(풋터 먼저 노출) 방지. 이미 0이면 no-op.
  // S334: 진입 가드(useItemArrivalGuard)가 html.item-arriving 으로 스크롤을 상단에
  // 묶어 둔 상태 → rAF 안에서 먼저 unlock 후 scrollIntoView (lock 중엔 scroll 무효).
  useEffect(() => {
    if (!isHighlight || !cardRef.current) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const el = cardRef.current;
    requestAnimationFrame(() => {
      unlockItemArrival();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [isHighlight]);

  // S311 D / S340: "아이템 도착" 감지 — scrollIntoView 로 카드가 화면에 충분히
  // (ratio ≥ 0.5) 들어오면 arrived. 점멸 자체는 imgReady 와 AND 로 시작(아래).
  useEffect(() => {
    if (!isHighlight) return;
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            setArrived(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isHighlight]);

  // S340: 점멸 = 아이템 도착(arrived) + 썸네일 이미지 로드(imgReady) 둘 다 충족 시 (파생).
  // 흐린/빈 썸네일 위에서 점멸이 새어 인지 실패하던 문제 해결. 이미지 없는 카드는
  // imgReady 가 초기 true 라 arrived 만으로 시작. isHighlight 아니면 자동 false.
  const flashActive = isHighlight && arrived && imgReady;

  const className = [
    cls.card,
    isVisible ? cls.visible : '',
    isHighlight ? cls.highlight : '',
    flashActive ? cls.flash : '',
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
      data-slug={dataSlug}
      data-cm-id={dataCmId}
    >
      {/* 클릭 영역은 썸네일만 — info(name/price) 영역은 cursor:default + 클릭 비활성.
          thumb 자체에 cursor:pointer + aspect-ratio 가 이미 정의됨 (sp-card-thumb / cm-card-thumb).
          aria-label/role/tabIndex 도 thumb 으로 이동 — 키보드/스크린 리더 타겟이 시각적 클릭 영역과 일치. */}
      <div
        className={cls.thumb}
        style={thumbAspect === '5:4' ? { aspectRatio: '5 / 4' } : undefined}
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
      >
        {imgSrc ? (
          /* S198 재마이그레이션: fill 폐기 + width/height 명시 패턴 (cacheComponents
             Suspense streaming 환경에서 fill 의 부모 layout 측정 race 회피).
             AVIF/WebP 자동 변환 + responsive sizes 회복. */
          <Image
            src={imgSrc}
            alt={imgAlt ?? ''}
            width={400}
            height={thumbAspect === '5:4' ? 320 : 400}
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
            className={cls.img}
            style={{
              width: '100%',
              height: '100%',
              objectFit: imgFit ?? (variant === 'cafe' ? 'cover' : 'contain'),
              /* P8 — inline backgroundColor 제거. CSS .sp-card-thumb / .cm-card-thumb
                 컨테이너의 background (단일 토큰) 가 placeholder 로 자연스럽게 비침.
                 DB bg 컬럼 의존 차단 → 사이트 placeholder 단일 색상 유지. */
            }}
            priority={imgPriority}
            placeholder={imgBlurDataURL ? 'blur' : 'empty'}
            blurDataURL={imgBlurDataURL}
            /* S340: 점멸 시작 게이트 — 실제 이미지 로드 완료(캐시 hit 포함) 시 ready. */
            onLoad={() => setImgReady(true)}
          />
        ) : (
          <div className={cls.img} style={imgStyle} />
        )}
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
