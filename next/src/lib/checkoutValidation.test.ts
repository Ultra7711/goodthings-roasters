/* ══════════════════════════════════════════════════════════════════════════
   checkoutValidation.test.ts — validateCheckoutForm 단위 테스트 (H-2 보강)

   커버리지:
   - 로그인 사용자: 필수 필드 + 약관
   - 비로그인 게스트: 위 + 비밀번호 필드
   - 이메일/전화/우편번호 형식 검증
   - 비밀번호 길이·불일치
   - 약관 미동의
   - 유효 케이스: 에러 맵 empty 확인
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { validateCheckoutForm } from './checkoutValidation';
import type { CheckoutFormData } from '@/types/checkout';
import { INITIAL_CHECKOUT } from '@/types/checkout';
import { GUEST_PASSWORD_MIN_LENGTH } from '@/lib/validation';

const AGREEMENTS_ACCEPTED = [true, true];
const AGREEMENTS_REJECTED = [false, false];

const VALID_FORM: CheckoutFormData = {
  ...INITIAL_CHECKOUT,
  email: 'test@example.com',
  firstname: '홍길동',
  phone: '010-1234-5678',
  zipcode: '12345',
  addr1: '서울시 강남구 테헤란로 1',
  addr2: '',
  deliveryMessage: '',
  deliveryCustom: '',
  guestPw: '',
  guestPw2: '',
};

const VALID_GUEST_FORM: CheckoutFormData = {
  ...VALID_FORM,
  guestPw: 'pass1234',
  guestPw2: 'pass1234',
};

/* ── 로그인 사용자 ── */
describe('validateCheckoutForm — 로그인 사용자', () => {
  it('모든 필드 유효 + 약관 동의 → 에러 없음', () => {
    const errors = validateCheckoutForm(VALID_FORM, AGREEMENTS_ACCEPTED, true);
    expect(errors).toEqual({});
  });

  it('이메일 빈 값 → email 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, email: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.email).toBe('이메일을 입력해 주세요.');
  });

  it('이메일 형식 오류 → email 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, email: 'not-an-email' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.email).toBe('올바른 이메일 형식을 입력해 주세요.');
  });

  it('이름 빈 값 → firstname 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, firstname: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.firstname).toBeTruthy();
  });

  it('전화번호 빈 값 → phone 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, phone: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.phone).toBe('전화번호를 입력해 주세요.');
  });

  it('전화번호 형식 오류 → phone 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, phone: '01012345678' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.phone).toBe('올바른 전화번호 형식을 입력해 주세요.');
  });

  it('우편번호 빈 값 → zipcode 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, zipcode: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.zipcode).toBe('주소를 검색해 주세요.');
  });

  it('우편번호 형식 오류 (4자리) → zipcode 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, zipcode: '1234' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.zipcode).toBe('올바른 우편번호(5자리)를 입력해 주세요.');
  });

  it('주소1 빈 값 → addr1 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, addr1: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.addr1).toBeTruthy();
  });

  it('약관 미동의 → agreement 에러', () => {
    const errors = validateCheckoutForm(VALID_FORM, AGREEMENTS_REJECTED, true);
    expect(errors.agreement).toBeTruthy();
  });

  it('로그인 사용자 — guestPw 비어있어도 에러 없음', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, guestPw: '', guestPw2: '' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.guestPw).toBeUndefined();
    expect(errors.guestPw2).toBeUndefined();
  });
});

/* ── 비로그인 게스트 ── */
describe('validateCheckoutForm — 비로그인 게스트', () => {
  it('모든 필드 유효 + 약관 동의 → 에러 없음', () => {
    const errors = validateCheckoutForm(VALID_GUEST_FORM, AGREEMENTS_ACCEPTED, false);
    expect(errors).toEqual({});
  });

  it('비밀번호 빈 값 → guestPw 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_GUEST_FORM, guestPw: '', guestPw2: '' },
      AGREEMENTS_ACCEPTED,
      false,
    );
    expect(errors.guestPw).toBe('비밀번호를 입력해 주세요.');
    expect(errors.guestPw2).toBe('비밀번호를 다시 입력해 주세요.');
  });

  it(`비밀번호 ${GUEST_PASSWORD_MIN_LENGTH}자 미만 → guestPw 에러`, () => {
    const short = 'a'.repeat(GUEST_PASSWORD_MIN_LENGTH - 1);
    const errors = validateCheckoutForm(
      { ...VALID_GUEST_FORM, guestPw: short, guestPw2: short },
      AGREEMENTS_ACCEPTED,
      false,
    );
    expect(errors.guestPw).toContain(`${GUEST_PASSWORD_MIN_LENGTH}자 이상`);
  });

  it('비밀번호 불일치 → guestPw2 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_GUEST_FORM, guestPw: 'pass1234', guestPw2: 'different' },
      AGREEMENTS_ACCEPTED,
      false,
    );
    expect(errors.guestPw2).toBe('비밀번호가 일치하지 않습니다.');
  });

  it('비밀번호 확인만 빈 값 → guestPw2 에러', () => {
    const errors = validateCheckoutForm(
      { ...VALID_GUEST_FORM, guestPw: 'pass1234', guestPw2: '' },
      AGREEMENTS_ACCEPTED,
      false,
    );
    expect(errors.guestPw).toBeUndefined();
    expect(errors.guestPw2).toBe('비밀번호를 다시 입력해 주세요.');
  });
});

/* ── 복합 에러 ── */
describe('validateCheckoutForm — 복합 에러', () => {
  it('빈 폼 + 비동의 + 비로그인 → 여러 에러 동시 반환', () => {
    const errors = validateCheckoutForm(INITIAL_CHECKOUT, AGREEMENTS_REJECTED, false);
    expect(errors.email).toBeTruthy();
    expect(errors.firstname).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.zipcode).toBeTruthy();
    expect(errors.addr1).toBeTruthy();
    expect(errors.guestPw).toBeTruthy();
    expect(errors.guestPw2).toBeTruthy();
    expect(errors.agreement).toBeTruthy();
  });

  it('이메일 공백만 있으면 빈 값 처리', () => {
    const errors = validateCheckoutForm(
      { ...VALID_FORM, email: '   ' },
      AGREEMENTS_ACCEPTED,
      true,
    );
    expect(errors.email).toBe('이메일을 입력해 주세요.');
  });
});
