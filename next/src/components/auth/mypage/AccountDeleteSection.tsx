/* ══════════════════════════════════════════
   AccountDeleteSection — 회원 탈퇴 (S197 PR-1.3.A)
   AccountManagement.tsx 분리 — 탈퇴 부분만 추출.
   AccountView 에서 사용.
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';
import { ChevronRight } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabase';
import { useDeleteAccount } from '@/hooks/useAccountDeletion';
import {
  useMyPageWithdrawOpen,
  setAddrOpen,
  setPwOpen,
  setSubEditId,
  setWithdrawOpen,
} from '@/lib/myPageUiStore';

type Props = {
  onLoggedOut: () => void;
};

export default function AccountDeleteSection({ onLoggedOut }: Props) {
  const { show: toast } = useToast();
  const isWithdrawOpen = useMyPageWithdrawOpen();
  const deleteAccountMutation = useDeleteAccount();

  /* 탈퇴 모달 스크롤 잠금 */
  useEffect(() => {
    if (!isWithdrawOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isWithdrawOpen]);

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
      <div
        className="mp-info-row mp-info-row--withdraw"
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
