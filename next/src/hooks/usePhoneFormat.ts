/* ══════════════════════════════════════════
   usePhoneFormat
   전화번호 입력 시 자동 하이픈 삽입
   프로토타입 formatPhoneNumber 이식
   ══════════════════════════════════════════ */

import { useCallback, type ChangeEvent } from 'react';

/** 숫자만 추출 후 하이픈 삽입 (010-1234-5678) */
function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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

  return { handleChange, formatPhoneNumber };
}
