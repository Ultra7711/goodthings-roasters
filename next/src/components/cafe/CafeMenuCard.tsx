/* ══════════════════════════════════════════
   CafeMenuCard (RP-5)
   프로토타입 `_cmCardHtml()` 이식.
   - 카드 클릭 → 우측 드로어(`CafeNutritionSheet`) 오픈. 카드 내부 오버레이 없음.
   - `.cm-card-info` 는 name + price 만 (프로토타입 parity).
   - 썸네일 우하단 온도 뱃지 (both/null 은 미표시)
   - 상단 좌측 status 뱃지 — ShopCard 와 동일한 `.sp-card-badge` 토큰 재사용
   - 스크롤 reveal: IntersectionObserver 기반 stagger (col idx × 70ms)
   - highlight 플래시: URL ?item=<id> 진입 시 `.cm-card--highlight` 부여
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { CafeMenuItem, CafeMenuStatus, CafeMenuTemp } from '@/lib/cafeMenu';

const SCROLL_REVEAL_THRESHOLD = 0.15;
const STAGGER_MS = 70;

/** 프로토타입 statusMap — `.sp-card-badge` + `badge-*` 조합 */
function getStatusBadgeClass(status: CafeMenuStatus): string | null {
  if (!status) return null;
  switch (status) {
    case '시즌':
    case '시즌 한정':
      return 'sp-card-badge badge-ltd';
    case '시그니처':
      return 'sp-card-badge badge-pop-1';
    case 'NEW':
      return 'sp-card-badge badge-new';
    case '인기':
      return 'sp-card-badge badge-pop-2';
    case '품절':
      return 'sp-card-badge badge-sold';
    default:
      return null;
  }
}

/** 프로토타입 tMap — 온도 뱃지 (우하단 원형) */
function getTempBadge(temp: CafeMenuTemp): { cls: string; txt: string } | null {
  if (!temp || temp === 'both') return null;
  switch (temp) {
    case 'ice-only':
      return { cls: 'cm-temp-ice-only', txt: 'ICE\nONLY' };
    case 'hot-only':
      return { cls: 'cm-temp-hot-only', txt: 'HOT\nONLY' };
    case 'warm':
      return { cls: 'cm-temp-warm', txt: 'WARM' };
    default:
      return null;
  }
}

type Props = {
  item: CafeMenuItem;
  colIndex: number; // 0~2, reveal stagger 용
  scrollRoot: HTMLElement | null;
  isHighlight: boolean;
  baseDelay?: number; // 초기 로드 시 추가 딜레이(ms) — 필터 전환 시는 0 (ShopCard 와 동일)
  instant?: boolean; // 탭 전환 후 새 카드 mount 시 true — entry 애니메이션 완전 스킵
  onOpenNutrition: (id: string) => void;
};

export default function CafeMenuCard({
  item,
  colIndex,
  scrollRoot,
  isHighlight,
  baseDelay = 0,
  instant = false,
  onOpenNutrition,
}: Props) {
  const [visible, setVisible] = useState(instant);
  const cardRef = useRef<HTMLDivElement>(null);

  // 스크롤 reveal — one-shot IntersectionObserver (RP-5d)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: scrollRoot, threshold: SCROLL_REVEAL_THRESHOLD },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, visible]);

  // URL `?item=` 진입 시 카드 자체 스크롤 인투뷰
  useEffect(() => {
    if (isHighlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlight]);

  const badgeClass = getStatusBadgeClass(item.status);
  const tempBadge = getTempBadge(item.temp);
  const thumbStyle = item.img
    ? `${item.bg || '#ECEAE6'} url('${item.img}') center/cover no-repeat`
    : '#ECEAE6';

  const handleOpen = () => onOpenNutrition(item.id);

  return (
    <div
      ref={cardRef}
      className={
        'cm-card' +
        (visible ? ' cm-visible' : '') +
        (isHighlight ? ' cm-card--highlight' : '')
      }
      style={{ transitionDelay: `${baseDelay + colIndex * STAGGER_MS}ms` }}
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      data-cm-id={item.id}
    >
      <div className="cm-card-thumb">
        <div className="cm-card-img" style={{ background: thumbStyle }} />

        {badgeClass && <span className={badgeClass}>{item.status}</span>}

        {tempBadge && (
          <div className="cm-temp-badges">
            <span className={`cm-badge-temp ${tempBadge.cls}`}>{tempBadge.txt}</span>
          </div>
        )}
      </div>

      <div className="cm-card-info">
        <p className="cm-card-name">{item.name}</p>
        <p className="cm-card-price">{item.price.toLocaleString('ko-KR')}원</p>
      </div>
    </div>
  );
}
