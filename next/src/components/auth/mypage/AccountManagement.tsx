'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { usePasswordChangeForm } from '@/hooks/usePasswordChangeForm';
import { shakeFields } from '@/lib/shakeFields';
import { useInputNav } from '@/hooks/useInputNav';
import { TextField } from '@/components/ui/TextField';
import { ChevronRight } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabase';
import { useDeleteAccount } from '@/hooks/useAccountDeletion';
import {
  useMyPagePwOpen,
  useMyPageWithdrawOpen,
  setAddrOpen,
  setPwOpen,
  setSubEditId,
  setWithdrawOpen,
} from '@/lib/myPageUiStore';

type Props = {
  onLoggedOut: () => void;
};

export default function AccountManagement({ onLoggedOut }: Props) {
  const { show: toast } = useToast();
  const isPwOpen = useMyPagePwOpen();
  const isWithdrawOpen = useMyPageWithdrawOpen();
  const deleteAccountMutation = useDeleteAccount();
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

  /* 탈퇴 모달 스크롤 잠금 */
  useEffect(() => {
    if (!isWithdrawOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isWithdrawOpen]);

  /* ── 회원 탈퇴 (Session 8-E · S161 PR-1) ──
     useDeleteAccount adapter 가 fetch + status 분기.
     409 subscription_active / 429 rate_limited / 200 success / network error
     모두 result kind 반환 → caller 가 toast + redirect 처리.
     성공 시 로컬 signOut + onLoggedOut() 리다이렉트. */
  const confirmWithdraw = useCallback(async () => {
    try {
      const result = await deleteAccountMutation.mutateAsync();
      switch (result.kind) {
        case 'subscription_active':
          toast('진행 중인 정기배송을 먼저 해지해 주세요.');
          return;
        case 'rate_limited':
          toast('요청이 많습니다. 잠시 후 다시 시도해 주세요.');
          return;
        case 'error':
          toast('탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
          return;
        case 'success':
          setWithdrawOpen(false);
          /* 서버에서 이미 signOut 완료 — 로컬 세션 쿠키 정리 (실패해도 무시) */
          await supabase.auth.signOut().catch(() => {});
          toast('탈퇴 처리가 완료되었습니다.');
          onLoggedOut();
      }
    } catch {
      toast('네트워크 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  }, [deleteAccountMutation, onLoggedOut, toast]);

  return (
    <>
      <div className="mp-section mp-section--no-border">
        <h2 className="mp-section-title">계정 관리</h2>
        <div className="mp-section-body">
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
            <span className="mp-icon-btn" aria-hidden="true" style={{ position: 'relative', top: 4 }}>
              <span className={`mp-chevron${isPwOpen ? ' open' : ''}`}>
                <ChevronRight />
              </span>
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
          <div
            className={`mp-info-row mp-info-row--withdraw${isPwOpen ? ' mp-withdraw-divider' : ''}`}
            style={{ borderBottom: 'none' }}
          >
            <span className="mp-info-label">회원 탈퇴</span>
            <button
              className="mp-icon-btn"
              type="button"
              aria-label="회원 탈퇴"
              style={{ position: 'relative', top: 4 }}
              onClick={() => {
                setAddrOpen(false);
                setPwOpen(false);
                setSubEditId(null);
                setWithdrawOpen(true);
              }}
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* ── 회원 탈퇴 모달 ── */}
      {isWithdrawOpen && (
        <div className="mp-modal-overlay" onClick={() => setWithdrawOpen(false)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <p className="mp-modal-title">떠나시는 건가요?</p>
            <p className="mp-modal-desc">
              탈퇴 시 로그아웃 처리되며, 이후 동일 계정으로<br />
              재가입하시더라도 기존 주문 내역은 복구되지 않습니다.
            </p>
            <div className="mp-modal-actions">
              <button
                className="mp-modal-cancel"
                type="button"
                onClick={() => setWithdrawOpen(false)}
                data-gtr-tap
              >
                취소
              </button>
              <button
                className="mp-modal-confirm mp-modal-confirm--danger"
                type="button"
                onClick={() => void confirmWithdraw()}
                data-gtr-tap
              >
                탈퇴
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
