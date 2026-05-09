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
  /**
   * close 시 trigger 요소로 focus 복원 여부. default true.
   * open 시점 activeElement 가 drawer 내부 요소(검색 input 등) 로 의도적으로
   * 이동하는 패턴에서는 false 로 지정해 close 후 input 재-focus 로 인한
   * 가상 키보드 재호출·원치 않는 focus 이동 방지.
   */
  restoreFocus?: boolean;
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
export function useDrawer({ open, onClose, restoreFocus = true }: UseDrawerArgs): void {
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
  //
  // trigger 판정 — activeElement 가 실제 포커스된 interactive 요소인 경우만 저장.
  // 모바일 터치·Safari macOS 기본은 click 에서 button 에 focus 를 주지 않아
  // activeElement=body (또는 null) 인 경우가 빈번. 이 상태에서 body.focus() 호출하면
  // tab 시퀀스가 문서 첫 focusable 요소로 리셋되어 "엉뚱한 곳 focus" 체감 발생.
  // interactive 태그(button/a/input/select/textarea) 또는 tabindex 명시 요소만 복원 대상.
  useEffect(() => {
    if (!open || typeof document === 'undefined' || !restoreFocus) return;
    const el = document.activeElement;
    const isInteractive =
      el instanceof HTMLElement &&
      el !== document.body &&
      (el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA' ||
        el.hasAttribute('tabindex'));
    const trigger = isInteractive ? (el as HTMLElement) : null;
    return () => {
      if (trigger && document.body.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [open, restoreFocus]);

  // body scroll lock.
  //
  // html { scrollbar-gutter: stable } 가 항상 거터를 예약하므로 body overflow 토글
  // 만으로 ICB·페이지 콘텐츠 폭이 변하지 않는다. fixed 패널은 각 panel CSS 에서
  // `right: calc(var(--scrollbar-w, 0px) * -1)` 로 visible viewport 우측까지 보정한다
  // (--scrollbar-w 는 SRInitializer 가 마운트 1회 주입).
  //
  // 이전 구현은 `html.scrollbarGutter='auto'` 로 ICB 를 +sb 만큼 확장했는데,
  // 그 결과 viewport 기반(100vw·fixed·aspect-ratio under fixed) 요소가 함께 늘어나
  // 페이지 이미지 height 가 점프하는 회귀가 있었다. body overflow 만 잠그는 방식으로 정리.
  //
  // useLayoutEffect: DOM 업데이트 직후·페인트 전 동기 실행.
  // useEffect 사용 시 첫 터치가 scroll lock 이전에 발생해 이벤트가 뚫리는 타이밍 버그 방지.
  useLayoutEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, [open]);
}
