/* ══════════════════════════════════════════
   Validation Utilities
   폼 검증 공용 정규식 + 헬퍼
   useCheckoutForm, useLoginForm, useAddressForm 공용
   ══════════════════════════════════════════ */

/** 이메일 — 영숫자·특수문자 허용, TLD 2자 이상 필수 */
export const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/** 전화번호 — 02-XXXX-XXXX / 0XX-XXX(X)-XXXX / 01X-XXXX-XXXX */
export const PHONE_RE = /^(02-\d{3,4}-\d{4}|0[1-9]\d-\d{3,4}-\d{4})$/;

/** 우편번호 (5자리 숫자) */
export const ZIPCODE_RE = /^\d{5}$/;

/** 주문번호 (GT-YYYYMMDD-NNNNN) */
export const ORDER_NUMBER_RE = /^GT-\d{8}-\d{5}$/;

/** 비밀번호 최소 길이 (회원가입 · 비회원 주문용) */
export const PASSWORD_MIN_LENGTH = 6;

/** 비밀번호 최대 길이 */
export const PASSWORD_MAX_LENGTH = 16;

/** 비회원 주문 비밀번호 최소 길이 (간이 검증용) */
export const GUEST_PASSWORD_MIN_LENGTH = 6;

/* ══════════════════════════════════════════
   검증 함수
   ══════════════════════════════════════════ */

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isValidZipcode(value: string): boolean {
  return ZIPCODE_RE.test(value.trim());
}

export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value.trim());
}

/**
 * 비밀번호 강도 검증
 * - 길이 6~16자
 * - 영문 대소문자 / 숫자 / 특수문자 중 2종류 이상 포함
 */
export type PasswordStrengthResult = {
  valid: boolean;
  reason?: 'length' | 'variety';
};

export function checkPasswordStrength(value: string): PasswordStrengthResult {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, reason: 'length' };
  }

  let varietyCount = 0;
  if (/[a-z]/.test(value)) varietyCount += 1;
  if (/[A-Z]/.test(value)) varietyCount += 1;
  if (/\d/.test(value)) varietyCount += 1;
  if (/[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/.test(value)) varietyCount += 1;

  if (varietyCount < 2) {
    return { valid: false, reason: 'variety' };
  }

  return { valid: true };
}

/** 비밀번호 강도 오류 메시지 */
export function passwordStrengthMessage(
  result: PasswordStrengthResult,
): string | null {
  if (result.valid) return null;
  if (result.reason === 'length') {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 ${PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }
  return '영문 대소문자·숫자·특수문자 중 2가지 이상을 포함해 주세요.';
}
