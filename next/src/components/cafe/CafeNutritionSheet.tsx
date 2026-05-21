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
import { getAllergenDisplayLabel } from '@/lib/allergenSort';
import {
  CAFE_CATEGORY_LABEL,
  getCafeImageMeta,
  type CafeMenuItem,
  type CafeMenuTemp,
} from '@/lib/cafeMenu';
import { CloseIcon } from '@/components/ui/Icons';
import MenuCardBadges from './MenuCardBadges';
import MenuLikeSheetButton from './MenuLikeSheetButton';
import MenuName from './MenuName';

/** 온도 pill (S245-P20 재설계 · outline 한 줄 텍스트). both = 표시 X. */
function getTempBadge(
  temp: CafeMenuTemp,
): { variant: 'ice' | 'hot' | 'warm'; txt: string } | null {
  if (!temp || temp === 'both') return null;
  switch (temp) {
    case 'ice-only':
      return { variant: 'ice', txt: 'ICE ONLY' };
    case 'hot-only':
      return { variant: 'hot', txt: 'HOT ONLY' };
    case 'warm':
      return { variant: 'warm', txt: 'WARM' };
    default:
      return null;
  }
}

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

  /* S247 폴리싱 + 강화 fix: 모바일 풀스크린 bottom sheet 에서 iOS Safari rubber-band
     overscroll 시 fixed panel 외부에 html bg (#1E1B16 다크) 가 프레임 단위로 노출되는
     점멸 현상 차단. 단일 fix 부족 → 다층 방어 (overscroll-behavior:none 은 CSS 측).
     - html 만 변경 시 body transparent 영역에서 일부 noise 잔존 → body 도 함께 변경.
     - prev 값 저장 → close 시 복원하여 OverscrollTop 적용 페이지와의 충돌 회피.
     - 데스크탑은 540px 우측 드로어 + dim 효과 보존 → 모바일 한정. */
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;
    const root = document.documentElement;
    const body = document.body;
    const prevRoot = root.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    /* stone-light (#E5E2DD) — globals.css `--color-surface-stone-light` 와 동기.
       토큰 변경 시 양쪽 함께 갱신 필요. */
    root.style.backgroundColor = '#E5E2DD';
    body.style.backgroundColor = '#E5E2DD';
    return () => {
      root.style.backgroundColor = prevRoot;
      body.style.backgroundColor = prevBody;
    };
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

        {item && (() => {
          const tempBadge = getTempBadge(item.temp);
          return (
          <>
            <div className="cns-image-wrap">
              {item.img && (() => {
                /* S245-P21: 정적 자산 blur (cafe-menu-blur.json) · 어드민 업로드는
                   DB blur_data_url fallback. 둘 중 있는 값 우선. */
                const meta = getCafeImageMeta(item.img);
                const blurDataURL = meta?.blurDataURL ?? item.blurDataUrl ?? undefined;
                return (
                  <Image
                    src={item.img}
                    alt=""
                    fill
                    sizes="(max-width: 479px) 100vw, 540px"
                    className="cns-image"
                    placeholder={blurDataURL ? 'blur' : 'empty'}
                    blurDataURL={blurDataURL}
                  />
                );
              })()}

              {/* S245-P20 재설계 — hero 좌상단 메타만 (좌하/우하 비움 · 시각 단순화).
                  온도/좋아요는 콘텐츠 영역으로 이동. */}
              <MenuCardBadges menuId={item.id} status={item.status} />
            </div>

            <div className="cns-content">
              <div className="cns-head">
                <div className="cns-head-top">
                  {/* 좌측 — 카테고리 라벨 + 메뉴명 (세로 stack) */}
                  <div className="cns-title-col">
                    <div className="cns-category-row">
                      <p className="cns-category-label">{categoryLabel}</p>
                      {tempBadge && (
                        <span
                          className={`cns-temp-pill cns-temp-pill--${tempBadge.variant}`}
                        >
                          {tempBadge.txt}
                        </span>
                      )}
                    </div>
                    <h2 className="cns-item-name">
                      <MenuName item={item} iconSize={28} />
                    </h2>
                  </div>
                  {/* 우측 — 좋아요 (좌측 두 행 세로 중앙 정렬) */}
                  <MenuLikeSheetButton menuId={item.id} menuName={item.name} />
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
                          {getAllergenDisplayLabel(chip)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
          );
        })()}
      </div>
    </div>
  );
}
