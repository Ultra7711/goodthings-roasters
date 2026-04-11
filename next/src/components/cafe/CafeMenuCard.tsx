/* ══════════════════════════════════════════
   CafeMenuCard (RP-5)
   프로토타입 `_cmCardHtml()` + `.cm-card--active` 인라인 오버레이 이식.
   - 카드 클릭 → 오버레이 토글 (장바구니 추가 없음, 매장 메뉴 전용)
   - 썸네일 우하단 온도 뱃지 (both/null 은 미표시)
   - 상단 좌측 status 뱃지 — ShopCard 와 동일한 `.sp-card-badge` 토큰 재사용 (프로토타입 동일)
   - 스크롤 reveal: RP-5d 에서 IntersectionObserver 기반 stagger (col idx × 70ms)
   - highlight 플래시: URL ?item=<id> 진입 시 1500ms 동안 `.cm-card--highlight` 부여
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CAFE_CATEGORY_LABEL,
  type CafeMenuItem,
  type CafeMenuStatus,
  type CafeMenuTemp,
} from '@/lib/cafeMenu';

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
  isActive: boolean;
  isHighlight: boolean;
  onToggle: () => void;
};

export default function CafeMenuCard({
  item,
  colIndex,
  scrollRoot,
  isActive,
  isHighlight,
  onToggle,
}: Props) {
  const [visible, setVisible] = useState(false);
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

  // URL `?item=` 진입 시 카드 자체 스크롤 인투뷰 — 상위 effect 의 setPage 후
  // 카드가 마운트되는 시점에 실행되므로 RAF 레이스 없이 안전
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

  const catLabel = CAFE_CATEGORY_LABEL[item.cat] ?? '';

  return (
    <div
      ref={cardRef}
      className={
        'cm-card' +
        (visible ? ' cm-visible' : '') +
        (isActive ? ' cm-card--active' : '') +
        (isHighlight ? ' cm-card--highlight' : '')
      }
      style={{ transitionDelay: `${colIndex * STAGGER_MS}ms` }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
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

        {/* 인라인 오버레이 — 카드 클릭 시 확장. 프로토타입 `.cm-card--active .cm-card-overlay` */}
        <div
          className="cm-card-overlay"
          onClick={(e) => {
            // 닫기 버튼 이외의 영역 클릭은 카드 onToggle 로 버블업 허용 (카드 루트에서 처리)
            e.stopPropagation();
            onToggle();
          }}
        >
          <button
            className="cm-ov-close"
            type="button"
            aria-label="닫기"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>

          <div className="cm-ov-top">
            <div>
              {catLabel && <span className="cm-ov-category">{catLabel}</span>}
              <span className="cm-ov-serving">1회 제공량 기준</span>
              {item.vol && <span className="cm-ov-vol">· {item.vol}</span>}
            </div>
            <span className="cm-ov-kcal">{item.kcal > 0 ? item.kcal : '—'} kcal</span>
          </div>

          <div className="cm-ov-table">
            {[
              ['포화지방', item.satfat || '—'],
              ['당류',     item.sugar  || '—'],
              ['나트륨',   item.sodium || '—'],
              ['단백질',   item.protein|| '—'],
              ['카페인',   item.caffeine|| '—'],
            ].map(([label, value]) => (
              <div key={label} className="cm-ov-row">
                <span className="cm-ov-rlabel">{label}</span>
                <span className="cm-ov-rval">{value}</span>
              </div>
            ))}
          </div>

          {item.allergen && (
            <div className="cm-ov-allergen">
              <span className="cm-ov-al-title">알레르기</span>
              <span className="cm-ov-al-list">{item.allergen}</span>
            </div>
          )}
        </div>
      </div>

      <div className="cm-card-info">
        <p className="cm-card-name">{item.name}</p>
        {item.menuDesc && (
          <p className="cm-card-menu-desc">{item.menuDesc.split('\n')[0]}</p>
        )}
        <p className="cm-card-price">{item.price.toLocaleString('ko-KR')}원</p>
      </div>
    </div>
  );
}
