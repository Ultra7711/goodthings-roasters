/* ══════════════════════════════════════════
   useOrderNumberFormat
   주문번호 입력 시 GT- 프리픽스 + 자동 하이픈
   포맷: GT-XXXXXXXX-XXXXX (날짜 8자리 - 시퀀스 5자리)
   ══════════════════════════════════════════ */

import { useCallback, type ChangeEvent, type ClipboardEvent, type FocusEvent } from 'react';

const PREFIX = 'GT-';
const DATE_LEN = 8;
const SEQ_LEN = 5;
const MAX_DIGITS = DATE_LEN + SEQ_LEN; // 13

/** 숫자만 추출 후 GT-XXXXXXXX-XXXXX 형식으로 포맷 */
function formatOrderNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_DIGITS);
  if (digits.length === 0) return PREFIX;
  if (digits.length <= DATE_LEN) return `${PREFIX}${digits}`;
  return `${PREFIX}${digits.slice(0, DATE_LEN)}-${digits.slice(DATE_LEN)}`;
}

/**
 * 주문번호 자동 포맷 훅
 * - 포커스 시 빈 필드면 GT- 프리필
 * - 숫자 입력 시 자동 하이픈
 * - 붙여넣기 시 숫자만 추출하여 포맷
 */
export function useOrderNumberFormat(
  onChange: (formatted: string) => void,
) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      /* GT- 프리픽스가 지워지지 않도록 보호 */
      const withoutPrefix = val.startsWith(PREFIX)
        ? val.slice(PREFIX.length)
        : val;
      onChange(formatOrderNumber(withoutPrefix));
    },
    [onChange],
  );

  /** TextField 컴포넌트처럼 string을 전달받는 경우 */
  const handleChangeValue = useCallback(
    (val: string) => {
      const withoutPrefix = val.startsWith(PREFIX)
        ? val.slice(PREFIX.length)
        : val;
      onChange(formatOrderNumber(withoutPrefix));
    },
    [onChange],
  );

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (!e.target.value) {
        onChange(PREFIX);
      }
    },
    [onChange],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text');
      /* GT- 프리픽스 포함 붙여넣기도 처리 */
      const stripped = pasted.replace(/^GT-?/i, '');
      onChange(formatOrderNumber(stripped));
    },
    [onChange],
  );

  return { handleChange, handleChangeValue, handleFocus, handlePaste };
}
