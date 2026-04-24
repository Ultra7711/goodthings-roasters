/* ══════════════════════════════════════════
   useDrawer (RP-5 / 2026-04-12)
   우측 슬라이드인 드로어 공통 로직.
   - ESC 키 닫기
   - 드로어 오픈 동안 body scroll lock
   상세 드로어 패턴: memory/feedback_drawer_pattern.md
   ══════════════════════════════════════════ */

import { useEffect, useLayoutEffect } from 'react';

type UseDrawerArgs = {
  /** 드로어 오픈 상태 */
  open: boolean;
  /** ESC 키 수신 시 호출 */
  onClose: () => void;
};

/**
 * 우측 슬라이드인 드로어(영양정보, 장바구니 등)의 공통 부수효과를 관리한다.
 *
 * - ESC 키로 onClose 호출
 * - open 동안 `document.body.style.overflow = 'hidden'` 로 scroll lock,
 *   언마운트/닫힘 시 이전 값 복구
 *
 * 새 드로어 추가 시 이 훅만 호출하면 두 동작이 자동으로 붙는다.
 */
export function useDrawer({ open, onClose }: UseDrawerArgs): void {
  // ESC 키 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // focus 복원 (BUG-128 · S74).
  // drawer open 직전의 activeElement (= trigger 버튼) 를 기억했다가 close 시 복원.
  // aria-hidden 영역 안에 focus 가 남아 스크린 리더 경고 나는 상황 방지 + 키보드 사용자 UX.
  useEffect(() => {
    if (!open) return;
    const trigger = (typeof document !== 'undefined'
      ? document.activeElement
      : null) as HTMLElement | null;
    return () => {
      if (trigger && typeof document !== 'undefined' && document.body.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [open]);

  // body scroll lock + scrollbar gutter 토글.
  //
  // 기본 상태: html { scrollbar-gutter: stable } 로 15px 예약 → ICB=1072.
  //   이 상태로 드로어를 열면 fixed 패널이 ICB 에 페인트 클리핑되어 우측 15px 잘림.
  //
  // 드로어 오픈 동안:
  //   1) html.scrollbarGutter='auto' → ICB 가 1087 로 확장 → 패널이 true viewport 에 도달
  //   2) body.paddingRight=<measured> → body content-box 1072 유지 → sticky 헤더·
  //      페이지 레이아웃이 시프트하지 않음 (UI-005 회귀 방지)
  //   3) body.overflow='hidden' → 페이지 스크롤 잠금
  //
  // useLayoutEffect: DOM 업데이트 직후·페인트 전 동기 실행.
  // useEffect 사용 시 첫 터치가 scroll lock 이전에 발생해 이벤트가 뚫리는 타이밍 버그 방지.
  useLayoutEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;

    // scrollbar-gutter: stable 이 활성화된 상태에서 clientWidth 는 innerWidth 와 동일하게
    // 보고되므로, 100vw 기반 프로브로 ICB 폭을 측정해 gutter 를 역산한다.
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;visibility:hidden;pointer-events:none';
    body.appendChild(probe);
    const sbWidth = Math.max(0, window.innerWidth - probe.offsetWidth);
    body.removeChild(probe);

    const prevGutter = html.style.scrollbarGutter;
    const prevPaddingRight = body.style.paddingRight;
    const prevOverflow = body.style.overflow;

    html.style.scrollbarGutter = 'auto';
    body.style.paddingRight = `${sbWidth}px`;
    body.style.overflow = 'hidden';

    return () => {
      html.style.scrollbarGutter = prevGutter;
      body.style.paddingRight = prevPaddingRight;
      body.style.overflow = prevOverflow;
    };
  }, [open]);
}
