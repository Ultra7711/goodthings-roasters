/* ══════════════════════════════════════════
   checkoutValidation — 체크아웃 폼 검증 pure 함수
   useCheckoutForm 의 validate 콜백에서 위임.
   React 없이 단독 테스트 가능.
   ══════════════════════════════════════════ */

import type { CheckoutFormData, CheckoutErrors } from '@/types/checkout';
import {
  EMAIL_RE,
  PHONE_RE,
  ZIPCODE_RE,
  GUEST_PASSWORD_MIN_LENGTH,
} from '@/lib/validation';

/**
 * 체크아웃 폼 전체 검증.
 * 반환값: 에러 맵 (비어있으면 유효).
 */
export function validateCheckoutForm(
  form: CheckoutFormData,
  agreements: boolean[],
  isLoggedIn: boolean,
): CheckoutErrors {
  const errors: CheckoutErrors = {};

  const emailTrimmed = form.email.trim();
  if (!emailTrimmed) {
    errors.email = '이메일을 입력해 주세요.';
  } else if (!EMAIL_RE.test(emailTrimmed)) {
    errors.email = '올바른 이메일 형식을 입력해 주세요.';
  }

  if (!form.firstname.trim()) errors.firstname = '이름을 입력해 주세요.';

  const phoneTrimmed = form.phone.trim();
  if (!phoneTrimmed) {
    errors.phone = '전화번호를 입력해 주세요.';
  } else if (!PHONE_RE.test(phoneTrimmed)) {
    errors.phone = '올바른 전화번호 형식을 입력해 주세요.';
  }

  const zipcodeTrimmed = form.zipcode.trim();
  if (!zipcodeTrimmed) {
    errors.zipcode = '주소를 검색해 주세요.';
  } else if (!ZIPCODE_RE.test(zipcodeTrimmed)) {
    errors.zipcode = '올바른 우편번호(5자리)를 입력해 주세요.';
  }

  if (!form.addr1.trim()) errors.addr1 = '주소를 검색해 주세요.';

  if (!isLoggedIn) {
    if (!form.guestPw) {
      errors.guestPw = '비밀번호를 입력해 주세요.';
    } else if (form.guestPw.length < GUEST_PASSWORD_MIN_LENGTH) {
      errors.guestPw = `비밀번호는 ${GUEST_PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
    }
    if (!form.guestPw2) {
      errors.guestPw2 = '비밀번호를 다시 입력해 주세요.';
    } else if (form.guestPw !== form.guestPw2) {
      errors.guestPw2 = '비밀번호가 일치하지 않습니다.';
    }
  }

  if (!agreements.every(Boolean)) {
    errors.agreement = '필수 약관에 모두 동의해 주세요.';
  }

  return errors;
}
