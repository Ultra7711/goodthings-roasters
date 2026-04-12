/* ══════════════════════════════════════════
   usePasswordChangeForm
   마이페이지 비밀번호 변경 폼 상태 관리
   프로토타입 #mp-pw-accordion 로직 이식
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  checkPasswordStrength,
  passwordStrengthMessage,
} from '@/lib/validation';

type PasswordChangeErrors = {
  current?: string;
  next?: string;
  confirm?: string;
  submit?: string;
};

type UsePasswordChangeFormOptions = {
  /** 저장 성공 시 호출 (아코디언 닫기 등) */
  onSuccess?: () => void;
};

export function usePasswordChangeForm({
  onSuccess,
}: UsePasswordChangeFormOptions = {}) {
  const updatePassword = useAuthStore((s) => s.updatePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [isLoading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setErrors({});
    setLoading(false);
  }, []);

  const clearFieldError = useCallback((field: keyof PasswordChangeErrors) => {
    setErrors((prev) => {
      if (!prev[field] && !prev.submit) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[field];
      delete nextErrors.submit;
      return nextErrors;
    });
  }, []);

  const handleCurrentChange = useCallback(
    (value: string) => {
      setCurrent(value);
      clearFieldError('current');
    },
    [clearFieldError],
  );

  const handleNextChange = useCallback(
    (value: string) => {
      setNext(value);
      clearFieldError('next');
      /* 새 비밀번호가 비워지면 확인 필드도 초기화 */
      if (!value && confirm) {
        setConfirm('');
      }
    },
    [clearFieldError, confirm],
  );

  const handleConfirmChange = useCallback(
    (value: string) => {
      setConfirm(value);
      clearFieldError('confirm');
    },
    [clearFieldError],
  );

  /** blur 시 새 비밀번호 강도 검증 */
  const blurNext = useCallback(() => {
    if (next) {
      const strength = checkPasswordStrength(next);
      if (!strength.valid) {
        setErrors((prev) => ({
          ...prev,
          next: passwordStrengthMessage(strength) ?? '비밀번호 강도가 부족합니다.',
        }));
      }
    }
  }, [next]);

  /** blur 시 비밀번호 확인 일치 검증 */
  const blurConfirm = useCallback(() => {
    if (confirm && next && next !== confirm) {
      setErrors((prev) => ({ ...prev, confirm: '비밀번호가 일치하지 않습니다.' }));
    }
  }, [next, confirm]);

  const submit = useCallback(async (): Promise<boolean> => {
    const newErrors: PasswordChangeErrors = {};

    if (!current) {
      newErrors.current = '현재 비밀번호를 입력해 주세요.';
    }

    if (!next) {
      newErrors.next = '새 비밀번호를 입력해 주세요.';
    } else {
      const strength = checkPasswordStrength(next);
      if (!strength.valid) {
        newErrors.next =
          passwordStrengthMessage(strength) ??
          '비밀번호 강도가 부족합니다.';
      }
    }

    if (!confirm) {
      newErrors.confirm = '새 비밀번호를 다시 입력해 주세요.';
    } else if (next && next !== confirm) {
      newErrors.confirm = '비밀번호가 일치하지 않습니다.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setLoading(true);
    const result = await updatePassword(current, next);
    setLoading(false);

    if (!result.ok) {
      setErrors({ current: result.error });
      return false;
    }

    reset();
    onSuccess?.();
    return true;
  }, [current, next, confirm, updatePassword, reset, onSuccess]);

  return {
    current,
    next,
    confirm,
    errors,
    isLoading,
    pw2Disabled: !next,
    setCurrent: handleCurrentChange,
    setNext: handleNextChange,
    setConfirm: handleConfirmChange,
    blurNext,
    blurConfirm,
    reset,
    submit,
  };
}
