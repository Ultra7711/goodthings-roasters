/* ══════════════════════════════════════════
   TextField — 공통 인풋 필드 컴포넌트

   bi-field ↔ chp-field 시스템 통합 (RP-9).
   chp-* CSS 클래스를 기반으로 단일 React 컴포넌트로 통합.

   지원 기능:
   - 플로팅 레이블
   - 헬퍼 텍스트 (포커스 시 + 에러 시 표시)
   - 에러 상태 (input-warn 클래스 + ⚠ 심볼 prefix)
   - ClearIcon 자동 표시/숨김
   - 비밀번호 눈 아이콘 토글 (showPasswordToggle)
   - Enter 키 네비게이션 (onKeyDown)
   - blur 검증 (onBlur)
   - 붙여넣기 핸들러 (onPaste) — 주문번호/전화번호 자동 포맷용
   ══════════════════════════════════════════ */

'use client';

import { forwardRef, useState } from 'react';
import type { CSSProperties, ClipboardEventHandler, FocusEventHandler, KeyboardEventHandler, MouseEventHandler } from 'react';
import { ClearIcon, EyeOpenIcon, EyeClosedIcon } from './InputIcons';

export type TextFieldProps = {
  /** 값 바인딩 — 컨트롤드 컴포넌트 */
  value: string;
  /** 값 변경 콜백 (문자열 전달) */
  onChange: (value: string) => void;

  /** 플로팅 레이블 텍스트 */
  label: string;

  /** 헬퍼 텍스트 — 기본값 or 에러 시 대체 표시됨 */
  helper?: string;
  /** 에러 메시지 — 설정 시 input-warn 적용 + 헬퍼 영역에 대체 표시 */
  error?: string | false | null;

  /** input type */
  type?: 'text' | 'email' | 'tel' | 'password';
  /** input id (접근성·label for) */
  id?: string;
  /** autocomplete 속성 */
  autoComplete?: string;
  /** maxlength 속성 */
  maxLength?: number;
  /** disabled 속성 */
  disabled?: boolean;
  /** readonly 속성 */
  readOnly?: boolean;
  /** inputmode 속성 (numeric, tel 등) */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  /** 추가 inline style (readonly 클릭 주소 검색 등) */
  style?: CSSProperties;

  /** blur 핸들러 — 폼 훅의 blurXxx 연결 */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** focus 핸들러 — 자동 포맷 훅 연결 */
  onFocus?: FocusEventHandler<HTMLInputElement>;
  /** paste 핸들러 — 주문번호/전화번호 자동 포맷 연결 */
  onPaste?: ClipboardEventHandler<HTMLInputElement>;
  /** keydown 핸들러 — useInputNav Enter 네비게이션 */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** click 핸들러 — readonly 주소 검색 등 */
  onClick?: MouseEventHandler<HTMLInputElement>;

  /** 클리어 커스텀 동작 — 기본: onChange('') */
  onClear?: () => void;
  /** 클리어 아이콘 숨기기 — 값이 있어도 숨김 (예: 주문번호 GT- 프리픽스만일 때) */
  hideClear?: boolean;

  /** 비밀번호 눈 아이콘 토글 (type='password'와 함께) */
  showPasswordToggle?: boolean;

  /** .chp-field 래퍼에 추가 클래스 (pw2-field, has-value 등) */
  wrapperClass?: string;

  /** 커스텀 액션 슬롯 — ClearIcon 대신 우측에 추가 아이콘 렌더 */
  customAction?: React.ReactNode;
};

/**
 * 공통 TextField — chp-field 마크업을 래핑.
 * 단일 라인 input 전용. textarea는 `Textarea` 컴포넌트 사용.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    value,
    onChange,
    label,
    helper,
    error,
    type = 'text',
    id,
    autoComplete,
    maxLength,
    disabled,
    readOnly,
    inputMode,
    style,
    onBlur,
    onFocus,
    onPaste,
    onKeyDown,
    onClick,
    onClear,
    hideClear,
    showPasswordToggle,
    wrapperClass,
    customAction,
  },
  ref
) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPw ? 'text' : type;

  const hasError = Boolean(error);
  const showClearIcon = !hideClear && value.length > 0 && !disabled && !readOnly;
  const showEyeIcon = showPasswordToggle && isPassword && value.length > 0;

  /** 두 개 이상의 액션 아이콘 래퍼가 필요한지 */
  const needsActionsWrapper = showEyeIcon && showClearIcon;

  const wrapperClassName = [
    'chp-field',
    hasError ? 'input-warn' : '',
    wrapperClass ?? '',
  ].filter(Boolean).join(' ');

  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  return (
    <div className={wrapperClassName}>
      <input
        ref={ref}
        id={id}
        className="chp-input"
        type={effectiveType}
        placeholder=" "
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        inputMode={inputMode}
        style={style}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onClick={onClick}
      />
      <label className="chp-floating-label" htmlFor={id}>
        {label}
      </label>

      {/* 커스텀 액션 (ClearIcon과 상호 배타적) */}
      {customAction}

      {/* 액션 아이콘 (눈 + 지우기 2개 이상인 경우 래퍼) */}
      {!customAction && needsActionsWrapper && (
        <span className="chp-input-actions">
          <span
            className="chp-input-action visible"
            onClick={() => setShowPw((v) => !v)}
            title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
          >
            {showPw ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </span>
          <span
            className="chp-input-action visible"
            onClick={handleClear}
            title="지우기"
          >
            <ClearIcon />
          </span>
        </span>
      )}

      {/* 눈 아이콘만 (값 없음일 때는 렌더 안 함 — 위에서 value>0 조건) */}
      {!customAction && showEyeIcon && !showClearIcon && (
        <span
          className="chp-input-action visible"
          onClick={() => setShowPw((v) => !v)}
          title={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          {showPw ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </span>
      )}

      {/* 클리어 아이콘만 */}
      {!customAction && showClearIcon && !showEyeIcon && (
        <span
          className="chp-input-action visible"
          onClick={handleClear}
          title="지우기"
        >
          <ClearIcon />
        </span>
      )}

      {/* 헬퍼 텍스트 — error 우선, 없으면 helper 기본값 */}
      {(helper || error) && (
        <div className="chp-helper">
          {error || helper}
        </div>
      )}
    </div>
  );
});
