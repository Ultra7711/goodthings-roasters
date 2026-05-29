/* ══════════════════════════════════════════
   EmailRegisterForm — 간편로그인(가상 이메일) 유저의 실제 이메일 등록 (S302)

   목적: 카카오/네이버 가상 이메일 계정에 실제 이메일 확보 (계정 자산).
   AccountInfoRow 의 가상 이메일 분기에서 렌더. PasswordChangeForm 아코디언 답습.
   검증 = Supabase email-change 링크 (useEmailRegisterForm · ADR-001 §3.2 DEC-E1).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { useEmailRegisterForm } from '@/hooks/useEmailRegisterForm';
import { shakeFields } from '@/lib/shakeFields';
import { useInputNav } from '@/hooks/useInputNav';
import { TextField } from '@/components/ui/TextField';
import ToggleIcon from './ToggleIcon';
import { useMyPageEmailOpen, setEmailOpen } from '@/lib/myPageUiStore';

export default function EmailRegisterForm() {
  const { show: toast } = useToast();
  const isOpen = useMyPageEmailOpen();
  const formRef = useRef<HTMLDivElement>(null);

  const form = useEmailRegisterForm({
    onSent: () => {
      toast('확인 메일을 보냈습니다. 메일의 링크를 클릭하면 등록이 완료됩니다.');
    },
  });

  const open = useCallback(() => {
    form.reset();
    setEmailOpen(true);
  }, [form]);

  const close = useCallback(() => {
    form.reset();
    setEmailOpen(false);
  }, [form]);

  const nav = useInputNav(formRef);

  return (
    <>
      <div
        className="mp-info-row mp-info-row--action"
        role="button"
        tabIndex={0}
        aria-label={isOpen ? '닫기' : '이메일 등록'}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            isOpen ? close() : open();
          }
        }}
      >
        <span className="mp-info-label">이메일 등록</span>
        <span className="mp-icon-btn" aria-hidden="true">
          <ToggleIcon open={isOpen} />
        </span>
      </div>
      <div className={`mp-form-reveal${isOpen ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner" ref={formRef}>
          {form.sent ? (
            <p className="mp-form-note">
              <strong>{form.email}</strong> 로 확인 메일을 보냈습니다.
              <br />
              메일의 링크를 클릭하면 이메일 등록이 완료됩니다.
            </p>
          ) : (
            <>
              <TextField
                type="email"
                label="이메일 주소"
                autoComplete="email"
                inputMode="email"
                value={form.email}
                onChange={form.setEmail}
                onBlur={form.blurEmail}
                onKeyDown={nav}
                error={form.error}
                helper="수신 가능한 이메일을 입력하세요. 확인 메일이 발송됩니다."
              />
              <div className="mp-form-reveal-actions">
                <button className="mp-cancel-btn" type="button" onClick={close} data-gtr-tap>
                  취소
                </button>
                <button
                  className="mp-save-btn"
                  type="button"
                  disabled={form.isLoading}
                  onClick={() => {
                    void form.submit();
                    setTimeout(() => shakeFields(formRef.current), 0);
                  }}
                  data-gtr-tap
                >
                  {form.isLoading ? '발송 중…' : '확인 메일 보내기'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
