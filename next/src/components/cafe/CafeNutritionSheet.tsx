/* ══════════════════════════════════════════
   CafeNutritionSheet (RP-5 / 2026-04-12 재이식)
   프로토타입 `#cafe-nutrition-sheet` + `openNutritionSheet(id)` 이식.
   - 카드 클릭 시 우측 슬라이드인 드로어로 영양정보 표시 (540px).
   - cart-drawer 와 동일한 슬라이드인 패턴 (bg + panel).
   - ESC/배경 클릭으로 닫기.
   ══════════════════════════════════════════ */

'use client';

import { useEffect } from 'react';
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

  // ESC 닫기 + body scroll lock — 공통 드로어 훅
  useDrawer({ open, onClose });

  // 배경 터치무브 차단 — iOS에서 body.overflow:hidden 우회 방지
  useEffect(() => {
    if (!open) return;
    const bg = document.getElementById('cns-bg');
    if (!bg) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    bg.addEventListener('touchmove', prevent, { passive: false });
    return () => bg.removeEventListener('touchmove', prevent);
  }, [open]);

  // 모바일 바텀시트 드래그-닫기 (≤479px)
  // 패널 최상단에서 아래로 80px 이상 스와이프 시 onClose 호출
  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById('cns-panel');
    if (!panel) return;

    let startY = 0;
    let dragging = false;

    function onStart(e: TouchEvent) {
      if (window.innerWidth > 479) return;
      if (panel!.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      dragging = true;
    }

    function onMove(e: TouchEvent) {
      if (!dragging) return;
      const dy = Math.max(0, e.touches[0].clientY - startY);
      if (dy > 0) {
        panel!.style.transition = 'none';
        panel!.style.transform = `translateY(${dy}px)`;
      }
    }

    function onEnd(e: TouchEvent) {
      if (!dragging) return;
      dragging = false;
      const dy = e.changedTouches[0].clientY - startY;
      panel!.style.transition = '';
      if (dy > 80) {
        onClose();
      } else {
        panel!.style.transform = '';
      }
    }

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: true });
    panel.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      panel.removeEventListener('touchstart', onStart);
      panel.removeEventListener('touchmove', onMove);
      panel.removeEventListener('touchend', onEnd);
      panel.style.transition = '';
      panel.style.transform = '';
    };
  }, [open, onClose]);

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
                <div className="cns-head-top">
                  <div className="cns-title-col">
                    <p className="cns-category-label">{categoryLabel}</p>
                    <h2 className="cns-item-name">{item.name}</h2>
                  </div>
                  {tempBadge && (
                    <span className={`cns-title-badge cm-badge-temp ${tempBadge.cls}`}>
                      {tempBadge.txt}
                    </span>
                  )}
                </div>
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
