/* ══════════════════════════════════════════
   Textarea — 공통 멀티라인 입력 필드

   TextField 와 대응되는 multiline 버전.
   chp-field / chp-input 시스템 재사용:
   - chp-input + chp-textarea 복합 클래스
   - floating label · helper · clear button 동일 패턴

   textarea 는 autoComplete / maxLength / inputMode 는 지원하지만
   password toggle 은 해당 없음.
   ══════════════════════════════════════════ */

'use client';

import { forwardRef } from 'react';
import type {
  CSSProperties,
  ClipboardEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
} from 'react';
import { ClearIcon } from './InputIcons';

export type TextareaProps = {
  /** 값 바인딩 — 컨트롤드 */
  value: string;
  /** 값 변경 콜백 */
  onChange: (value: string) => void;

  /** 플로팅 레이블 텍스트 */
  label: string;

  /** 헬퍼 텍스트 (포커스 시) */
  helper?: string;
  /** 에러 메시지 (input-warn 적용 + 헬퍼 대체 표시) */
  error?: string | false | null;

  /** textarea id (접근성·label for) */
  id?: string;
  /** maxlength */
  maxLength?: number;
  /** disabled */
  disabled?: boolean;
  /** readonly */
  readOnly?: boolean;
  /** textarea 행 수 */
  rows?: number;
  /** 추가 inline style */
  style?: CSSProperties;

  /** blur 핸들러 */
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  /** focus 핸들러 */
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
  /** paste 핸들러 */
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  /** keydown 핸들러 */
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;

  /** 클리어 커스텀 동작 — 기본: onChange('') */
  onClear?: () => void;
  /** 클리어 아이콘 숨기기 */
  hideClear?: boolean;

  /** .chp-field 래퍼에 추가 클래스 */
  wrapperClass?: string;
};

/**
 * 공통 Textarea — chp-field + chp-textarea 마크업을 래핑.
 * multiline 입력 전용. single-line 은 `TextField` 사용.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    label,
    helper,
    error,
    id,
    maxLength,
    disabled,
    readOnly,
    rows = 5,
    style,
    onBlur,
    onFocus,
    onPaste,
    onKeyDown,
    onClear,
    hideClear,
    wrapperClass,
  },
  ref,
) {
  const hasError = Boolean(error);
  const showClearIcon = !hideClear && value.length > 0 && !disabled && !readOnly;

  const wrapperClassName = [
    'chp-field',
    'chp-field-textarea',
    hasError ? 'input-warn' : '',
    wrapperClass ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  return (
    <div className={wrapperClassName}>
      <textarea
        ref={ref}
        id={id}
        className="chp-input chp-textarea"
        placeholder=" "
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
      />
      <label className="chp-floating-label" htmlFor={id}>
        {label}
      </label>

      {/* 클리어 아이콘 — textarea 는 상단 우측 */}
      {showClearIcon && (
        <span
          className="chp-input-action chp-textarea-clear visible"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          title="지우기"
          role="button"
          aria-label="지우기"
        >
          <ClearIcon />
        </span>
      )}

      {/* 헬퍼 / 에러 */}
      {(helper || error) && <div className="chp-helper">{error || helper}</div>}
    </div>
  );
});
