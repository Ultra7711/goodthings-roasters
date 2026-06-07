/* ══════════════════════════════════════════
   PasswordChangeForm — 비밀번호 변경 (S197 PR-1.3.A)
   AccountManagement.tsx 분리 — 비밀번호 부분만 추출.
   AccountView 에서 사용 (S197 PR-2 에서 ProfileView → AccountView 이관).
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { usePasswordChangeForm } from '@/hooks/usePasswordChangeForm';
import { shakeFields } from '@/lib/shakeFields';
import { useInputNav } from '@/hooks/useInputNav';
import { TextField } from '@/components/ui/TextField';
import ToggleIcon from './ToggleIcon';
import { useMyPagePwOpen, setPwOpen } from '@/lib/myPageUiStore';

export default function PasswordChangeForm() {
  const { show: toast } = useToast();
  const isPwOpen = useMyPagePwOpen();
  const pwFormRef = useRef<HTMLDivElement>(null);

  const pwForm = usePasswordChangeForm({
    onSuccess: () => {
      setPwOpen(false);
      toast('비밀번호가 변경되었습니다.');
    },
  });

  const openPwAccordion = useCallback(() => {
    pwForm.reset();
    setPwOpen(true);
  }, [pwForm]);

  const pwNav = useInputNav(pwFormRef);

  return (
    <>
      <div
        className="mp-info-row mp-info-row--action"
        role="button"
        tabIndex={0}
        aria-label={isPwOpen ? '닫기' : '비밀번호 변경'}
        onClick={() => {
          if (isPwOpen) {
            pwForm.reset();
            setPwOpen(false);
          } else {
            openPwAccordion();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isPwOpen) {
              pwForm.reset();
              setPwOpen(false);
            } else {
              openPwAccordion();
            }
          }
        }}
      >
        <span className="mp-info-label">비밀번호 변경</span>
        {/* S283: 공통 ToggleIcon (chevron ↔ X) — 마이페이지 아코디언 통일. */}
        <span className="mp-icon-btn" aria-hidden="true">
          <ToggleIcon open={isPwOpen} />
        </span>
      </div>
      <div className={`mp-form-reveal${isPwOpen ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner" ref={pwFormRef}>
          <TextField
            type="password"
            label="현재 비밀번호"
            value={pwForm.current}
            onChange={pwForm.setCurrent}
            onKeyDown={pwNav}
            showPasswordToggle
            error={pwForm.errors.current}
            helper="현재 비밀번호를 입력하세요."
          />
          <TextField
            type="password"
            label="새 비밀번호"
            value={pwForm.next}
            onChange={pwForm.setNext}
            onBlur={pwForm.blurNext}
            onKeyDown={pwNav}
            showPasswordToggle
            error={pwForm.errors.next}
            helper="영문 대소문자/숫자/특수문자 중 2가지 이상 조합, 6~16자"
          />
          <TextField
            type="password"
            label="새 비밀번호 확인"
            disabled={pwForm.pw2Disabled}
            value={pwForm.confirm}
            onChange={pwForm.setConfirm}
            onBlur={pwForm.blurConfirm}
            onKeyDown={pwNav}
            showPasswordToggle
            error={pwForm.errors.confirm}
            helper="비밀번호를 한 번 더 입력하세요."
            wrapperClass={`pw2-field${pwForm.next ? ' pw2-visible' : ''}`}
          />
          <div className="mp-form-reveal-actions">
            <button
              className="mp-cancel-btn"
              type="button"
              onClick={() => { pwForm.reset(); setPwOpen(false); }}
              data-gtr-tap
            >
              취소
            </button>
            <button
              className="mp-save-btn"
              type="button"
              onClick={() => {
                void pwForm.submit();
                setTimeout(() => shakeFields(pwFormRef.current), 0);
              }}
              data-gtr-tap
            >
              변경
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
