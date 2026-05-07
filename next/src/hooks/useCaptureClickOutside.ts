/* ══════════════════════════════════════════
   useCaptureClickOutside — capture-phase 외부 클릭 닫기

   isOpen=true 인 동안 document click capture-phase listener 등록.
   ref 외부 클릭 시 e.stopPropagation() + onClose() 호출.

   feedback_capture_phase_handler_collision 규칙 준수 — capture-phase 사용 시
   다른 핸들러 충돌 방지를 위해 stopPropagation 명시.

   사용처:
   - SubscriptionEditor cycle dropdown (BUG-125 fix 패턴)
   - 기타 외부 클릭 닫기 패턴 재사용
   ══════════════════════════════════════════ */

import { useEffect, type RefObject } from 'react';

export function useCaptureClickOutside(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const onCapture = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
  }, [ref, isOpen, onClose]);
}
