/* ══════════════════════════════════════════
   useLoginForm
   로그인 폼 상태 + 검증 + Supabase 이메일 로그인 연동
   - 이메일/비번 blank/형식 검증
   - supabase.auth.signInWithPassword() 직접 호출
   - 성공 시 fromCheckout 여부에 따라 리다이렉트
   ADR-004 Step C-3: useAuthStore 제거 · DEMO_CREDENTIALS 제거.
   ══════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';

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
};

/** Supabase 에러 메시지를 사용자 친화 문구로 변환 */
function mapLoginError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (lower.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.';
  }
  return '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export function useLoginForm(
  options: UseLoginFormOptions = {},
): UseLoginFormReturn {
  const { fromCheckout = false } = options;

  const router = useRouter();

  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

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

  /** 로그인 실행 (검증 통과 후) */
  const runLogin = useCallback(
    async (emailValue: string, passwordValue: string) => {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue,
        });
        if (error) {
          setErrors({ submit: mapLoginError(error.message) });
          return;
        }
        redirectOnSuccess();
      } finally {
        setIsLoading(false);
      }
    },
    [redirectOnSuccess],
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

  return {
    email,
    password,
    errors,
    isLoading,
    setEmail,
    setPassword,
    blurEmail,
    handleSubmit,
  };
}
