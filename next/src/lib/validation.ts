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

/** 주문번호 (GT-YYYYMMDD-NNNNN[N]) — 011 하드닝으로 5~6자리 시퀀스 허용 */
export const ORDER_NUMBER_RE = /^GT-\d{8}-\d{5,6}$/;

/** 비밀번호 최소 길이 (회원가입 · 비회원 주문용) */
export const PASSWORD_MIN_LENGTH = 6;

/** 비밀번호 최대 길이 */
export const PASSWORD_MAX_LENGTH = 16;

/** 비회원 주문 비밀번호 최소 길이 — 서버 GUEST_PIN_MIN(4)과 일치 */
export const GUEST_PASSWORD_MIN_LENGTH = 4;

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
 * 한국 사업자등록번호 체크섬 검증 (국세청 알고리즘 · S243-B).
 * - 10자리 숫자
 * - 가중치 [1,3,7,1,3,7,1,3,5] 를 첫 9자리에 곱하여 합산
 * - 9번째 자리(인덱스 8) 의 가중치 5 결과는 10 으로 나눈 몫을 추가 합산
 * - 체크 디지트 = (10 - (sum % 10)) % 10
 * - 체크 디지트 === 10번째 자리(인덱스 9) 면 유효
 *
 * 빈 값은 true 반환 (선택 필드 — 빈 값은 형식 검증에서 거름).
 */
export function isValidKoreanBizRegNum(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return true;
  if (digits.length !== 10) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  sum += Math.floor((parseInt(digits[8], 10) * 5) / 10);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(digits[9], 10);
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
