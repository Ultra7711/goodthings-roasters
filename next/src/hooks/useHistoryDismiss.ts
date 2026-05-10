/* ══════════════════════════════════════════
   useHistoryDismiss (S204 / 2026-05-11)
   모달·드로어·시트의 브라우저 back 버튼 dismiss 처리 통합 훅.

   배경:
   - 모바일 사용자는 back 버튼 = 시트 닫기 를 기대 (인스타·X·네이버 표준).
   - history-unaware 시트는 back 시 페이지 자체 이탈 또는 무반응.
   - bfcache (iOS Safari / Chrome) 가 React state 보존 → 재진입 시 시트 열린 채.

   동작:
   1. open: false → true 감지 → history.pushState({gtrModal: scope}) marker 추가
   2. open: true → false 감지 (사용자 X/ESC/배경 클릭) → marker 살아있으면 history.back 으로 정리
   3. popstate listener: state.gtrModal !== scope → onClose 호출 (idempotent)
   4. pageshow event.persisted=true (bfcache 복원) → onClose 강제 호출
   5. unmount cleanup: marker 살아있으면 history.back 으로 정리

   사용처별 scope 키 (충돌 방지):
   - 'cafe-nutri-sheet'
   - 'gd-lightbox'
   - 'search-panel'
   - 'cart-drawer' (BUG-133 패턴 호환 — 후속 리팩터)
   - 'mobile-nav'   (S67 패턴 호환 — 후속 리팩터)

   주의:
   - onClose 는 idempotent setState 만 권장. 분석/사이드 이펙트는 별도 click 핸들러에 두기.
   - 한 페이지 내 동일 scope 모달 동시 다수 금지 (marker 충돌).
   ══════════════════════════════════════════ */

import { useEffect, useRef } from 'react';

type UseHistoryDismissArgs = {
  /** 모달/시트/드로어 open 상태 */
  open: boolean;
  /** popstate / bfcache / 외부 close 시 호출 (idempotent setState 권장) */
  onClose: () => void;
  /** 다른 모달과 marker 충돌 방지용 unique key */
  scope: string;
};

type ModalHistoryState = { gtrModal?: string } | null;

function readModalScope(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const state = window.history.state as ModalHistoryState;
  return state?.gtrModal;
}

export function useHistoryDismiss({ open, onClose, scope }: UseHistoryDismissArgs): void {
  // onClose ref — 최신 콜백 유지하면서 listener effect 의 deps 에서 제외 (재구독 방지)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // open transition 감지용 prev ref
  const prevOpenRef = useRef(open);

  // open 변화에 따른 marker push / back 처리
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prev = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!prev && open) {
      // false → true: marker push (이미 동일 scope marker 있으면 skip — 방어)
      if (readModalScope() !== scope) {
        window.history.pushState({ gtrModal: scope }, '', window.location.href);
      }
    } else if (prev && !open) {
      // true → false: marker 살아있으면 back 으로 정리.
      // popstate 경로로 이미 marker 가 사라진 경우 (브라우저 back 으로 닫힘) 는 noop.
      if (readModalScope() === scope) {
        window.history.back();
      }
    }
  }, [open, scope]);

  // popstate — 사용자가 브라우저 back 으로 marker entry 벗어난 경우 onClose
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onPopState() {
      if (readModalScope() !== scope) {
        onCloseRef.current();
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [scope]);

  // pageshow — bfcache 복원 시 (event.persisted=true) 강제 닫기
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) {
        onCloseRef.current();
      }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // unmount cleanup — marker 살아있으면 replaceState 로 조용히 정리.
  // history.back() 대신 replaceState 사용 이유: hook unmount 시점은 보통 라우트 전환과 동반되는데
  // back 호출 시 router.push 와 race 가 발생하거나, 새 페이지 진입 후 사용자가 back 시
  // 두 번 뒤로 가야 하는 어색함 발생. CartDrawer.closeForNavigation 의 의도와 동일.
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (readModalScope() === scope) {
        window.history.replaceState(null, '', window.location.href);
      }
    };
  }, [scope]);
}
