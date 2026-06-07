/* ══════════════════════════════════════════
   AccountDeleteSection — 회원 탈퇴 (S197 PR-1.3.A)
   AccountManagement.tsx 분리 — 탈퇴 부분만 추출.
   AccountView 에서 사용.

   S312: 인라인 mp-modal → ConfirmModal 컴포넌트 + useScrollLockOnModal 훅으로
         통일 (SubscriptionEditor 와 동일 패턴). 탈퇴 모달도 calm(애니메이션 없음)
         으로 다른 confirm 모달과 동작 일치.
   ══════════════════════════════════════════ */

'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { ChevronRight } from '@/components/ui/Icons';
import { supabase } from '@/lib/supabase';
import { useDeleteAccount } from '@/hooks/useAccountDeletion';
import { useScrollLockOnModal } from '@/hooks/useScrollLockOnModal';
import ConfirmModal from './ConfirmModal';
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

  /* 탈퇴 모달 스크롤 잠금 (마이페이지 공용 훅) */
  useScrollLockOnModal(isWithdrawOpen);

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
        <ConfirmModal
          title="떠나시는 건가요?"
          desc={
            <>
              탈퇴 시 로그아웃 처리되며, 이후 동일 계정으로<br />
              재가입하시더라도 기존 주문 내역은 복구되지 않습니다.
            </>
          }
          confirmLabel="탈퇴"
          confirmVariant="danger"
          onCancel={() => setWithdrawOpen(false)}
          onConfirm={() => void confirmWithdraw()}
        />
      )}
    </>
  );
}
