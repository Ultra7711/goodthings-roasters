/* ══════════════════════════════════════════
   useRegisterForm
   회원가입 폼 상태 + 검증 + Auth 스토어 연동
   - 이름/이메일/비번/비번확인 검증
   - 비밀번호 강도(6~16자 · 2종류 이상) 검증
   - useAuthStore.register() 호출
   - 성공 시 /mypage 이동
   ══════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  isValidEmail,
  checkPasswordStrength,
  passwordStrengthMessage,
} from '@/lib/validation';

type RegisterFormErrors = {
  name?: string;
  email?: string;
  password?: string;
  password2?: string;
  submit?: string;
};

type UseRegisterFormReturn = {
  name: string;
  email: string;
  password: string;
  password2: string;
  errors: RegisterFormErrors;
  isLoading: boolean;
  /** 비밀번호 확인 필드 비활성 여부 (첫 비번 미입력 시) */
  pw2Disabled: boolean;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setPassword2: (value: string) => void;
  blurEmail: () => void;
  blurPassword: () => void;
  blurPassword2: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function useRegisterForm(): UseRegisterFormReturn {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [name, setNameState] = useState('');
  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [password2, setPassword2State] = useState('');
  const [errors, setErrors] = useState<RegisterFormErrors>({});

  /** 특정 필드 에러 + submit 에러 제거 */
  const clearFieldError = useCallback((field: keyof RegisterFormErrors) => {
    setErrors((prev) => {
      if (!prev[field] && !prev.submit) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.submit;
      return next;
    });
  }, []);

  const setName = useCallback(
    (value: string) => {
      setNameState(value);
      clearFieldError('name');
    },
    [clearFieldError],
  );

  const setEmail = useCallback(
    (value: string) => {
      setEmailState(value);
      clearFieldError('email');
    },
    [clearFieldError],
  );

  const setPassword = useCallback(
    (value: string) => {
      setPasswordState(value);
      clearFieldError('password');
      /* 비번이 비어지면 확인 필드도 초기화 (프로토타입 재현) */
      if (value.length === 0 && password2.length > 0) {
        setPassword2State('');
      }
    },
    [clearFieldError, password2.length],
  );

  const setPassword2 = useCallback(
    (value: string) => {
      setPassword2State(value);
      clearFieldError('password2');
    },
    [clearFieldError],
  );

  /** blur 시 이메일 형식 검증 */
  const blurEmail = useCallback(() => {
    const trimmed = email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setErrors((prev) => ({ ...prev, email: '올바른 이메일 형식을 입력해 주세요.' }));
    }
  }, [email]);

  /** blur 시 비밀번호 강도 검증 */
  const blurPassword = useCallback(() => {
    if (password) {
      const strength = checkPasswordStrength(password);
      if (!strength.valid) {
        setErrors((prev) => ({
          ...prev,
          password: passwordStrengthMessage(strength) ?? '비밀번호 형식이 올바르지 않습니다.',
        }));
      }
    }
  }, [password]);

  /** blur 시 비밀번호 확인 일치 검증 */
  const blurPassword2 = useCallback(() => {
    if (password2 && password && password !== password2) {
      setErrors((prev) => ({ ...prev, password2: '비밀번호가 일치하지 않습니다.' }));
    }
  }, [password, password2]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const newErrors: RegisterFormErrors = {};
      const nameTrimmed = name.trim();
      const emailTrimmed = email.trim();

      if (!nameTrimmed) {
        newErrors.name = '이름을 입력해 주세요.';
      }

      if (!emailTrimmed) {
        newErrors.email = '이메일을 입력해 주세요.';
      } else if (!isValidEmail(emailTrimmed)) {
        newErrors.email = '올바른 이메일 형식을 입력해 주세요.';
      }

      if (!password) {
        newErrors.password = '비밀번호를 입력해 주세요.';
      } else {
        const strength = checkPasswordStrength(password);
        if (!strength.valid) {
          newErrors.password = passwordStrengthMessage(strength) ?? '비밀번호 형식이 올바르지 않습니다.';
        }
      }

      if (!password2) {
        newErrors.password2 = '비밀번호를 다시 입력해 주세요.';
      } else if (password !== password2) {
        newErrors.password2 = '비밀번호가 일치하지 않습니다.';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});

      void (async () => {
        const result = await register(nameTrimmed, emailTrimmed, password);
        if (result.ok) {
          router.push('/mypage');
        } else {
          setErrors({ submit: result.error });
        }
      })();
    },
    [name, email, password, password2, register, router],
  );

  return {
    name,
    email,
    password,
    password2,
    errors,
    isLoading,
    pw2Disabled: password.length === 0,
    setName,
    setEmail,
    setPassword,
    setPassword2,
    blurEmail,
    blurPassword,
    blurPassword2,
    handleSubmit,
  };
}
