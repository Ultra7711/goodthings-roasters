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
  // 트리거 2종:
  // 1) 거리: 아래로 80px 이상 스와이프
  // 2) 속도(fling): 최근 100ms 평균 0.5px/ms (=500px/s) 이상 + 최소 30px 이동
  // 시작 위치 2종:
  // - 패널 본체: 컨텐츠 scrollTop=0 일 때만 (스크롤 우선)
  // - 드래그 핸들(.cns-drag-handle): scrollTop 무관하게 항상 허용
  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById('cns-panel');
    if (!panel) return;

    let startY = 0;
    let dragging = false;
    /* 최근 100ms 위치 샘플 — fling velocity 계산용 */
    let samples: { y: number; t: number }[] = [];

    function onStart(e: TouchEvent) {
      if (window.innerWidth > 479) return;
      /* 핸들에서 시작한 터치는 scrollTop 무관하게 허용. 그 외는 컨텐츠
         스크롤 우선 (scrollTop>0 이면 드래그-닫기 비활성). */
      const target = e.target as HTMLElement | null;
      const fromHandle = target?.closest('#cns-drag-handle') !== null;
      if (!fromHandle && panel!.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      samples = [{ y: startY, t: Date.now() }];
      dragging = true;
    }

    function onMove(e: TouchEvent) {
      if (!dragging) return;
      const y = e.touches[0].clientY;
      const t = Date.now();
      const dy = y - startY;
      samples.push({ y, t });
      /* 최근 100ms 만 유지 — fling 판정 윈도우 */
      samples = samples.filter((s) => t - s.t <= 100);
      if (dy > 0) {
        e.preventDefault(); // Chrome: passive:false + preventDefault로 body scroll 차단
        panel!.style.transition = 'none';
        panel!.style.transform = `translateY(${dy}px)`;
      } else {
        panel!.style.transform = ''; // 반대 방향 → 패널 원위치
      }
    }

    function onEnd(e: TouchEvent) {
      if (!dragging) return;
      dragging = false;
      const y = e.changedTouches[0].clientY;
      const dy = y - startY;
      panel!.style.transition = '';

      /* velocity 계산 — 최근 윈도우의 oldest sample 부터 현재까지의 평균.
         윈도우가 너무 짧으면(터치 후 즉시 떼는 탭) 0 으로 간주. */
      let velocity = 0;
      const oldest = samples[0];
      if (oldest && samples.length > 1) {
        const dt = Date.now() - oldest.t;
        if (dt > 0) velocity = (y - oldest.y) / dt;
      }

      const distanceTrigger = dy > 80;
      const flingTrigger = dy > 30 && velocity > 0.5;

      if (distanceTrigger || flingTrigger) {
        onClose();
      } else {
        panel!.style.transform = '';
      }
      samples = [];
    }

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
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
        {/* 모바일 바텀시트 드래그 핸들 — 데스크탑에선 CSS 로 숨김.
            ::before 가상요소 대신 실제 DOM 으로 변환하여 핸들 자체를 hit
            target 으로 사용 (scrollTop 무관 드래그 허용). */}
        <div id="cns-drag-handle" className="cns-drag-handle" aria-hidden="true">
          <div className="cns-drag-handle-bar" />
        </div>
        <button
          id="cns-close"
          type="button"
          aria-label="닫기"
          onClick={onClose}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19,5l-14,14" />
            <path d="M5,5l14,14" />
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
