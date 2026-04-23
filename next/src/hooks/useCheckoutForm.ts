/* ══════════════════════════════════════════
   useCheckoutForm
   체크아웃 폼 상태 관리 + 검증
   ══════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import type {
  CheckoutFormData,
  CheckoutErrors,
  PaymentMethod,
} from '@/types/checkout';
import { INITIAL_CHECKOUT } from '@/types/checkout';
import {
  EMAIL_RE,
  PHONE_RE,
  ZIPCODE_RE,
  GUEST_PASSWORD_MIN_LENGTH,
} from '@/lib/validation';

type UseCheckoutFormReturn = {
  form: CheckoutFormData;
  errors: CheckoutErrors;
  agreements: boolean[];
  allAgreed: boolean;
  isFormRevealed: boolean;
  setField: <K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  toggleAgreement: (idx: number) => void;
  toggleAllAgreements: () => void;
  revealForm: () => void;
  validate: (isLoggedIn: boolean) => boolean;
  clearErrors: () => void;
  blurEmail: () => void;
  blurPhone: () => void;
  /** 전체 리셋 — form + errors + agreements + revealed 상태를 초기화. */
  reset: () => void;
};

const AGREEMENT_COUNT = 2;

export function useCheckoutForm(): UseCheckoutFormReturn {
  const [form, setForm] = useState<CheckoutFormData>(INITIAL_CHECKOUT);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [agreements, setAgreements] = useState<boolean[]>(
    Array(AGREEMENT_COUNT).fill(false),
  );
  const [isFormRevealed, setIsFormRevealed] = useState(false);

  const allAgreed = agreements.every(Boolean);

  const setField = useCallback(
    <K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const setPaymentMethod = useCallback((method: PaymentMethod) => {
    setForm((prev) => ({
      ...prev,
      paymentMethod: method,
      bankName: '',
      depositorName: '',
    }));
  }, []);

  const toggleAgreement = useCallback((idx: number) => {
    setAgreements((prev) => prev.map((v, i) => (i === idx ? !v : v)));
    setErrors((prev) => {
      if (!prev.agreement) return prev;
      const next = { ...prev };
      delete next.agreement;
      return next;
    });
  }, []);

  const toggleAllAgreements = useCallback(() => {
    setAgreements((prev) => {
      const allChecked = prev.every(Boolean);
      return prev.map(() => !allChecked);
    });
    setErrors((prev) => {
      if (!prev.agreement) return prev;
      const next = { ...prev };
      delete next.agreement;
      return next;
    });
  }, []);

  const revealForm = useCallback(() => {
    setIsFormRevealed(true);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /* BUG-006 Stage D-1 확장: Activity stale state 리셋.
     cacheComponents 활성화로 /checkout 이 hidden 보존되어 로그인 유저의
     주소·연락처가 게스트 모드로 유출되는 문제 해결용. 로그인 상태 변경
     감지 시 CheckoutPage 에서 호출. */
  const reset = useCallback(() => {
    setForm(INITIAL_CHECKOUT);
    setErrors({});
    setAgreements(Array(AGREEMENT_COUNT).fill(false));
    setIsFormRevealed(false);
  }, []);

  /** blur 시 이메일 형식 검증 */
  const blurEmail = useCallback(() => {
    const trimmed = form.email.trim();
    if (trimmed && !EMAIL_RE.test(trimmed)) {
      setErrors((prev) => ({ ...prev, email: '올바른 이메일 형식을 입력해 주세요.' }));
    }
  }, [form.email]);

  /** blur 시 전화번호 형식 검증 */
  const blurPhone = useCallback(() => {
    const trimmed = form.phone.trim();
    if (trimmed && !PHONE_RE.test(trimmed)) {
      setErrors((prev) => ({ ...prev, phone: '올바른 전화번호 형식을 입력해 주세요.' }));
    }
  }, [form.phone]);

  const validate = useCallback(
    (isLoggedIn: boolean): boolean => {
      const newErrors: CheckoutErrors = {};

      /* 필수 필드 */
      const emailTrimmed = form.email.trim();
      if (!emailTrimmed) {
        newErrors.email = '이메일을 입력해 주세요.';
      } else if (!EMAIL_RE.test(emailTrimmed)) {
        newErrors.email = '올바른 이메일 형식을 입력해 주세요.';
      }
      if (!form.firstname.trim()) newErrors.firstname = '이름을 입력해 주세요.';
      const phoneTrimmed = form.phone.trim();
      if (!phoneTrimmed) {
        newErrors.phone = '전화번호를 입력해 주세요.';
      } else if (!PHONE_RE.test(phoneTrimmed)) {
        newErrors.phone = '올바른 전화번호 형식을 입력해 주세요.';
      }
      const zipcodeTrimmed = form.zipcode.trim();
      if (!zipcodeTrimmed) {
        newErrors.zipcode = '주소를 검색해 주세요.';
      } else if (!ZIPCODE_RE.test(zipcodeTrimmed)) {
        newErrors.zipcode = '올바른 우편번호(5자리)를 입력해 주세요.';
      }
      if (!form.addr1.trim()) newErrors.addr1 = '주소를 검색해 주세요.';

      /* 계좌이체 전용 */
      if (form.paymentMethod === 'transfer') {
        if (!form.bankName.trim()) newErrors.bankName = '은행명을 입력해 주세요.';
        if (!form.depositorName.trim()) newErrors.depositorName = '입금자명을 입력해 주세요.';
      }

      /* 비회원 비밀번호 */
      if (!isLoggedIn) {
        if (!form.guestPw) {
          newErrors.guestPw = '비밀번호를 입력해 주세요.';
        } else if (form.guestPw.length < GUEST_PASSWORD_MIN_LENGTH) {
          newErrors.guestPw = `비밀번호는 ${GUEST_PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
        }
        if (!form.guestPw2) {
          newErrors.guestPw2 = '비밀번호를 다시 입력해 주세요.';
        } else if (form.guestPw !== form.guestPw2) {
          newErrors.guestPw2 = '비밀번호가 일치하지 않습니다.';
        }
      }

      /* 약관 */
      if (!agreements.every(Boolean)) {
        newErrors.agreement = '필수 약관에 모두 동의해 주세요.';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [form, agreements],
  );

  return {
    form,
    errors,
    agreements,
    allAgreed,
    isFormRevealed,
    setField,
    setPaymentMethod,
    toggleAgreement,
    toggleAllAgreements,
    revealForm,
    validate,
    clearErrors,
    blurEmail,
    blurPhone,
    reset,
  };
}
