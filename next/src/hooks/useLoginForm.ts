/* ══════════════════════════════════════════
   useLoginForm
   로그인 폼 상태 + 검증 + Auth 스토어 연동
   - 이메일/비번 blank/형식 검증
   - useAuthStore.login() 호출
   - 성공 시 fromCheckout 여부에 따라 리다이렉트
   ══════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { isValidEmail } from '@/lib/validation';
import { DEMO_CREDENTIALS } from '@/lib/mockMyPageData';

type LoginFormErrors = {
  email?: string;
  password?: string;
  submit?: string;
};

type UseLoginFormOptions = {
  /** 체크아웃에서 진입했는지 여부 (성공 시 리다이렉트 분기) */
  fromCheckout?: boolean;
};

type UseLoginFormReturn = {
  email: string;
  password: string;
  errors: LoginFormErrors;
  isLoading: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  blurEmail: () => void;
  /** 폼 submit 핸들러 */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** 데모 계정으로 즉시 로그인 */
  loginAsDemo: () => void;
};

export function useLoginForm(
  options: UseLoginFormOptions = {},
): UseLoginFormReturn {
  const { fromCheckout = false } = options;

  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});

  /** 입력 변경 시 해당 필드 에러 + submit 에러 제거 */
  const setEmail = useCallback((value: string) => {
    setEmailState(value);
    setErrors((prev) => {
      if (!prev.email && !prev.submit) return prev;
      const next = { ...prev };
      delete next.email;
      delete next.submit;
      return next;
    });
  }, []);

  const setPassword = useCallback((value: string) => {
    setPasswordState(value);
    setErrors((prev) => {
      if (!prev.password && !prev.submit) return prev;
      const next = { ...prev };
      delete next.password;
      delete next.submit;
      return next;
    });
  }, []);

  /** blur 시 이메일 형식 검증 */
  const blurEmail = useCallback(() => {
    const trimmed = email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setErrors((prev) => ({ ...prev, email: '올바른 이메일 형식을 입력해 주세요.' }));
    }
  }, [email]);

  /** 로그인 성공 후 리다이렉트 */
  const redirectOnSuccess = useCallback(() => {
    router.push(fromCheckout ? '/checkout' : '/mypage');
  }, [router, fromCheckout]);

  /** 공용 로그인 실행 (검증 제외) */
  const runLogin = useCallback(
    async (emailValue: string, passwordValue: string) => {
      const result = await login(emailValue, passwordValue);
      if (result.ok) {
        redirectOnSuccess();
      } else {
        setErrors({ submit: result.error });
      }
    },
    [login, redirectOnSuccess],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const newErrors: LoginFormErrors = {};
      const emailTrimmed = email.trim();

      if (!emailTrimmed) {
        newErrors.email = '이메일을 입력해 주세요.';
      } else if (!isValidEmail(emailTrimmed)) {
        newErrors.email = '올바른 이메일 형식을 입력해 주세요.';
      }

      if (!password) {
        newErrors.password = '비밀번호를 입력해 주세요.';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      void runLogin(emailTrimmed, password);
    },
    [email, password, runLogin],
  );

  /* 테스트 계정 로그인 — 개발 환경 전용 */
  const loginAsDemo = useCallback(() => {
    if (process.env.NODE_ENV !== 'development') return;
    setEmailState(DEMO_CREDENTIALS.email);
    setPasswordState(DEMO_CREDENTIALS.password);
    setErrors({});
    void runLogin(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
  }, [runLogin]);

  return {
    email,
    password,
    errors,
    isLoading,
    setEmail,
    setPassword,
    blurEmail,
    handleSubmit,
    loginAsDemo,
  };
}
