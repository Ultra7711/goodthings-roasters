/* ══════════════════════════════════════════
   CafeNutritionSheet (RP-5 / 2026-04-12 재이식)
   프로토타입 `#cafe-nutrition-sheet` + `openNutritionSheet(id)` 이식.
   - 카드 클릭 시 우측 슬라이드인 드로어로 영양정보 표시 (540px).
   - cart-drawer 와 동일한 슬라이드인 패턴 (bg + panel).
   - ESC/배경 클릭으로 닫기.
   ══════════════════════════════════════════ */

'use client';

import { useDrawer } from '@/hooks/useDrawer';
import {
  CAFE_CATEGORY_LABEL,
  type CafeMenuItem,
  type CafeMenuTemp,
} from '@/lib/cafeMenu';

type Props = {
  item: CafeMenuItem | null;
  onClose: () => void;
};

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

export default function CafeNutritionSheet({ item, onClose }: Props) {
  const open = item !== null;

  // ESC 닫기 + body scroll lock — 공통 드로어 훅 (장바구니 드로어도 동일 사용 예정)
  useDrawer({ open, onClose });

  const tempBadge = item ? getTempBadge(item.temp) : null;
  const categoryLabel = item ? CAFE_CATEGORY_LABEL[item.cat] ?? item.cat.toUpperCase() : '';

  return (
    <div id="cafe-nutrition-sheet" className={open ? 'open' : ''} aria-hidden={!open}>
      {/* backdrop-filter 는 inline style 로 주입 — Tailwind v4 + Lightning CSS drop 이슈 회피 */}
      <div
        id="cns-bg"
        onClick={onClose}
        style={{
          backdropFilter: 'var(--overlay-dim-blur)',
          WebkitBackdropFilter: 'var(--overlay-dim-blur)',
        }}
      />
      <div id="cns-panel" role="dialog" aria-label="메뉴 영양정보">
        <button
          id="cns-close"
          type="button"
          aria-label="닫기"
          onClick={onClose}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18,6l-12,12" />
            <path d="M6,6l12,12" />
          </svg>
        </button>

        {item && (
          <>
            <div className="cns-image-wrap">
              {item.img ? (
                <div
                  className="cns-image"
                  style={{
                    backgroundImage: `url('${item.img}')`,
                    backgroundColor: item.bg || 'var(--color-background-secondary)',
                  }}
                />
              ) : (
                <div className="cns-image" style={{ display: 'none' }} />
              )}
              {tempBadge && (
                <div className="cns-temp-badge" style={{ display: 'block' }}>
                  <span className={`cm-badge-temp ${tempBadge.cls}`}>{tempBadge.txt}</span>
                </div>
              )}
            </div>

            <div className="cns-content">
              <div className="cns-head">
                <p className="cns-category-label">{categoryLabel}</p>
                <h2 className="cns-item-name">{item.name}</h2>
                {item.menuDesc && (
                  <p className="cns-item-desc">{item.menuDesc}</p>
                )}
                <p className="cns-item-volume">
                  {item.vol ? `${item.vol} · 1회 제공량 기준` : '1회 제공량 기준'}
                </p>
              </div>

              <div className="cns-table">
                {[
                  ['칼로리', item.kcal !== undefined ? `${item.kcal} kcal` : '—'],
                  ['포화지방', item.satfat || '—'],
                  ['당류', item.sugar || '—'],
                  ['나트륨', item.sodium || '—'],
                  ['단백질', item.protein || '—'],
                  ['카페인', item.caffeine || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="cns-row">
                    <span className="cns-row-label">{label}</span>
                    <span className="cns-row-value">{value}</span>
                  </div>
                ))}
              </div>

              {item.allergen && (() => {
                const chips = item.allergen
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                if (chips.length === 0) return null;
                return (
                  <div className="cns-allergen">
                    <p className="cns-allergen-title">알레르기 유발 성분</p>
                    <div className="cns-allergen-chips">
                      {chips.map((chip) => (
                        <span key={chip} className="cns-allergen-chip">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
