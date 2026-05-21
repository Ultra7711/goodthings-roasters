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
        // preventScroll: true — focus() 의 기본 동작은 element 를 viewport 에 보이게
        // 자동 scroll. drawer close 시 trigger (예: 헤더 cart icon) 로 페이지가 점프
        // → useDrawer 의 scrollTo 가 원위치 복원하는 paint race 플래시 발생.
        // "y 일정 offset 위로 점프 후 복귀" 패턴은 focus() 자동 scroll 의 특징.
        trigger.focus({ preventScroll: true });
      }
    };
  }, [open, restoreFocus]);

  // body scroll lock.
  //
  // 데스크탑은 `body.overflow = 'hidden'` 으로 충분하지만 iOS Safari 등 터치 디바이스는
  // body overflow 만으로는 background scroll 차단이 안 된다 (모바일 웹 고전적 함정).
  // drawer 가 열린 상태에서 panel 외 영역 (dim bg) 을 touch 하면 밑 페이지가 그대로 scroll.
  // → 터치 디바이스에서만 body 를 `position: fixed; top: -scrollY` 로 고정.
  //
  // 데스크탑에 동일 트릭을 적용하면 close 시점에 body 가 static 으로 복원되며 한 프레임
  // 동안 scrollY=0 위치가 paint 된 뒤 scrollTo(0, scrollY) 가 복원하는 layout race 가
  // 발생 → "플래시" 체감. `pointer: coarse` matchMedia 로 터치 환경만 분기 적용한다.
  //
  // html { scrollbar-gutter: stable } 가 항상 거터를 예약하므로 body 토글만으로
  // ICB·페이지 콘텐츠 폭이 변하지 않는다. fixed 패널은 각 panel CSS 에서
  // `right: calc(var(--scrollbar-w, 0px) * -1)` 로 visible viewport 우측까지 보정한다
  // (--scrollbar-w 는 SRInitializer 가 마운트 1회 주입).
  //
  // useLayoutEffect: DOM 업데이트 직후·페인트 전 동기 실행.
  // useEffect 사용 시 첫 터치가 scroll lock 이전에 발생해 이벤트가 뚫리는 타이밍 버그 방지.
  useLayoutEffect(() => {
    if (!open) return;
    const body = document.body;
    const isTouch =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    const scrollY = window.scrollY;
    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    body.style.overflow = 'hidden';
    if (isTouch) {
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
    }
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      // 모든 환경에서 scroll 복원 — 데스크탑에서도 body.overflow 토글로 인해
      // scroll position 이 일시적으로 drift 되는 케이스 (긴 페이지 하단에서
      // drawer 닫을 때 위로 점프했다 복귀하는 플래시) 차단. 변동 없으면 no-op.
      window.scrollTo(0, scrollY);
    };
  }, [open]);
}
