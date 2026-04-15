/* ══════════════════════════════════════════
   usePasswordChangeForm
   마이페이지 비밀번호 변경 폼 상태 관리
   프로토타입 #mp-pw-accordion 로직 이식
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

  /* Supabase 에러 메시지 → 한국어 변환 맵.
     ⚠️ current 비밀번호는 클라이언트 UI 용도로만 수집되며 서버에서 검증하지 않음.
        TODO(Phase 3): Server Action + supabase.auth.reauthenticate()로 강화. */
  const KR_PW_ERRORS: Record<string, string> = {
    'New password should be different from the old password.': '기존 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.',
    'Password should be at least 6 characters.': '비밀번호는 6자 이상이어야 합니다.',
    'Auth session missing!': '세션이 만료되었습니다. 다시 로그인해 주세요.',
  };

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

    /* Supabase auth.updateUser로 비밀번호 변경.
       ⚠️ current 비밀번호 서버사이드 검증 불가 (Supabase JS v2 한계).
          OAuth 전용 사용자는 비밀번호가 없어 에러 반환됨.
          TODO(Phase 3): Server Action + reauthenticate API로 강화. */
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);

    if (error) {
      setErrors({ submit: KR_PW_ERRORS[error.message] ?? '비밀번호 변경에 실패했습니다. 다시 시도해 주세요.' });
      return false;
    }

    reset();
    onSuccess?.();
    return true;
  }, [current, next, confirm, reset, onSuccess]);

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
