/* ══════════════════════════════════════════
   usePhoneFormat
   전화번호 입력 시 자동 하이픈 삽입
   프로토타입 formatPhoneNumber 이식
   ══════════════════════════════════════════ */

import { useCallback, type ChangeEvent } from 'react';

/** 숫자만 추출 후 하이픈 삽입 — 02(서울 2-4-4) / 그 외(3-4-4) 분기 */
function formatPhoneNumber(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('02')) {
    const n = d.slice(0, 10);
    if (n.length <= 2) return n;
    if (n.length <= 6) return `${n.slice(0, 2)}-${n.slice(2)}`;
    return `${n.slice(0, 2)}-${n.slice(2, n.length - 4)}-${n.slice(n.length - 4)}`;
  }
  const n = d.slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return `${n.slice(0, 3)}-${n.slice(3)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;
}

/**
 * 전화번호 자동 하이픈 훅
 * @param onChange 실제 onChange 핸들러 (포맷된 값 전달)
 */
export function usePhoneFormat(
  onChange: (formatted: string) => void,
) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      onChange(formatted);
    },
    [onChange],
  );

  /** TextField처럼 string을 전달받는 경우 */
  const handleChangeValue = useCallback(
    (val: string) => {
      onChange(formatPhoneNumber(val));
    },
    [onChange],
  );

  return { handleChange, handleChangeValue, formatPhoneNumber };
}
