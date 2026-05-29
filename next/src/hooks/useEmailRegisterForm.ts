/* ══════════════════════════════════════════
   useEmailRegisterForm — 간편로그인(가상 이메일) 유저의 실제 이메일 등록 폼

   목적: 카카오/네이버 가상 이메일 계정에 실제 이메일을 확보 (계정 자산).
   검증: ADR-001 §3.2 — Supabase 내장 email-change 링크 (DEC-E1).
     supabase.auth.updateUser({ email }) → Supabase 가 신규 이메일로 확인 링크 발송
     (Secure email change OFF 전제 · 가상 기존 주소 미발송). 중복 이메일·rate limit 은
     Supabase 가 자체 거부 → 에러 매핑.
     사용자가 링크 클릭 → /auth/email-confirm 에서 verifyOtp 로 확정.

   마이페이지(EmailRegisterForm) + 주문 승격(OrderCompletePage) 공용.
   usePasswordChangeForm 답습.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';

type UseEmailRegisterFormOptions = {
  /** 초기 이메일 (주문 승격 시 contact_email prefill) */
  initialEmail?: string;
  /** 확인 메일 발송 성공 시 호출 */
  onSent?: () => void;
};

/* Supabase AuthError → 한국어 변환. message/code/status 로 분기. (테스트용 export) */
export function mapEmailError(error: { message?: string; code?: string; status?: number }): string {
  const msg = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';
  if (code === 'email_exists' || msg.includes('already been registered') || msg.includes('already registered')) {
    return '이미 가입된 이메일입니다. 해당 이메일로 로그인해 주세요.';
  }
  if (error.status === 429 || msg.includes('rate limit')) {
    return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (msg.includes('should be different') || msg.includes('same')) {
    return '현재 등록된 이메일과 동일합니다.';
  }
  return '이메일 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export function useEmailRegisterForm({
  initialEmail = '',
  onSent,
}: UseEmailRegisterFormOptions = {}) {
  const [email, setEmailState] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setLoading] = useState(false);
  /** 확인 메일 발송 완료 — UI 가 "메일함 확인" 안내로 전환 */
  const [sent, setSent] = useState(false);

  const reset = useCallback(() => {
    setEmailState(initialEmail);
    setError(undefined);
    setLoading(false);
    setSent(false);
  }, [initialEmail]);

  const setEmail = useCallback((value: string) => {
    setEmailState(value);
    setError(undefined);
  }, []);

  /** blur 시 형식 검증 (값 있을 때만) */
  const blurEmail = useCallback(() => {
    if (email.trim() && !isValidEmail(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
    }
  }, [email]);

  const submit = useCallback(async (): Promise<boolean> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('이메일을 입력해 주세요.');
      return false;
    }
    if (!isValidEmail(trimmed)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return false;
    }

    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser(
      { email: trimmed },
      { emailRedirectTo: `${window.location.origin}/auth/email-confirm` },
    );
    setLoading(false);

    if (updErr) {
      setError(mapEmailError(updErr));
      return false;
    }

    setSent(true);
    onSent?.();
    return true;
  }, [email, onSent]);

  return {
    email,
    error,
    isLoading,
    sent,
    setEmail,
    blurEmail,
    submit,
    reset,
  };
}
