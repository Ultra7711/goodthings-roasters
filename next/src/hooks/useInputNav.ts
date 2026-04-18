/* ══════════════════════════════════════════
   useInputNav — 인풋 필드 Enter 키 네비게이션
   컨테이너 내 input/select 요소를 순회하며
   Enter → 다음 필드 포커스, 마지막 필드 → submit 콜백 실행.
   ══════════════════════════════════════════ */

import { useCallback, type KeyboardEvent, type RefObject } from 'react';

export function useInputNav(
  containerRef: RefObject<HTMLElement | null>,
  onSubmitLast?: () => void,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const inputs = Array.from(
        container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled])',
        ),
      );

      const idx = inputs.indexOf(e.currentTarget as HTMLInputElement | HTMLSelectElement);
      if (idx < 0) return;

      if (idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      } else if (onSubmitLast) {
        onSubmitLast();
      } else if ('requestSubmit' in container && typeof container.requestSubmit === 'function') {
        (container as HTMLFormElement).requestSubmit();
      }
    },
    [containerRef, onSubmitLast],
  );

  return handleKeyDown;
}
