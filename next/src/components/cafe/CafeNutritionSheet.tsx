/* ══════════════════════════════════════════
   CafeNutritionSheet (RP-5 / 2026-04-12 재이식)
   프로토타입 `#cafe-nutrition-sheet` + `openNutritionSheet(id)` 이식.
   - 카드 클릭 시 우측 슬라이드인 드로어로 영양정보 표시 (540px).
   - cart-drawer 와 동일한 슬라이드인 패턴 (bg + panel).
   - ESC/배경 클릭으로 닫기.

   S203: 모바일 collapsing hero 패턴 — 시트 max-height 90vh, 시트 자체 스크롤,
         hero 위 메타/좋아요/온도 뱃지 (카드와 동일 위치),
         핸들 제거 + close sticky (시트 우상단 fixed-feeling).
   ══════════════════════════════════════════ */

'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useDrawer } from '@/hooks/useDrawer';
import { useHistoryDismiss } from '@/hooks/useHistoryDismiss';
import {
  CAFE_CATEGORY_LABEL,
  getCafeImageMeta,
  type CafeMenuItem,
} from '@/lib/cafeMenu';
import { CloseIcon } from '@/components/ui/Icons';

type Props = {
  item: CafeMenuItem | null;
  onClose: () => void;
};

export default function CafeNutritionSheet({ item, onClose }: Props) {
  const open = item !== null;

  // ESC 닫기 + body scroll lock — 공통 드로어 훅
  useDrawer({ open, onClose });

  // 브라우저 back 버튼 = 시트 닫기 + bfcache 복원 시 강제 닫기 (S204)
  useHistoryDismiss({ open, onClose, scope: 'cafe-nutri-sheet' });

  // 배경 터치무브 차단 — iOS에서 body.overflow:hidden 우회 방지
  useEffect(() => {
    if (!open) return;
    const bg = document.getElementById('cns-bg');
    if (!bg) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    bg.addEventListener('touchmove', prevent, { passive: false });
    return () => bg.removeEventListener('touchmove', prevent);
  }, [open]);

  const categoryLabel = item ? CAFE_CATEGORY_LABEL[item.cat] ?? item.cat.toUpperCase() : '';

  return (
    <div id="cafe-nutrition-sheet" className={open ? 'open' : ''} aria-hidden={!open}>
      <div
        id="cns-bg"
        onClick={onClose}
      />
      <div id="cns-panel" role="dialog" aria-label="메뉴 영양정보">
        {/* close sticky wrapper — height:0 로 자리 차지 X, sticky top:0 → 시트 스크롤
            진행과 무관하게 panel 상단에 고정. close 버튼은 그 안에서 absolute right. */}
        <div className="cns-sticky-actions">
          <button
            id="cns-close"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            <CloseIcon size={24} />
          </button>
        </div>

        {item && (
          <>
            <div className="cns-image-wrap">
              {item.img && (() => {
                const meta = getCafeImageMeta(item.img);
                return (
                  <Image
                    src={item.img}
                    alt=""
                    fill
                    sizes="(max-width: 479px) 100vw, 540px"
                    className="cns-image"
                    placeholder={meta ? 'blur' : 'empty'}
                    blurDataURL={meta?.blurDataURL}
                  />
                );
              })()}
            </div>

            <div className="cns-content">
              <div className="cns-head">
                <div className="cns-head-top">
                  <div className="cns-title-col">
                    <p className="cns-category-label">{categoryLabel}</p>
                    <h2 className="cns-item-name">{item.name}</h2>
                  </div>
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
