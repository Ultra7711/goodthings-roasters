/* ══════════════════════════════════════════
   useSubscriptionActions — 정기배송 편집 callbacks 통합 훅

   SubscriptionEditor 의 7개 callback 을 mutations + toast + store setters 와 함께 캡슐화.
   호출처는 destructure 만으로 모든 액션 사용. UI 컴포넌트 (SubscriptionEditor) 에서
   로직/렌더링 분리 → 컴포넌트는 JSX 에 집중.

   - openSubAccordion: 편집 모드 진입 (id + cycle 셋업, dropdown 닫기)
   - previewNextDate: cycle 변경 시 다음 배송일 미리보기 (서버 정책 동일 가정)
   - saveSubCycle: 배송 주기 변경 (paused 분기 포함)
   - cancelSub / skipDelivery / pauseSub / resumeSub: 4 mutation actions
   ══════════════════════════════════════════ */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import type { SubscriptionCycle } from '@/types/subscription';
import { recalculateNextDeliveryOnCycleChange } from '@/lib/subscription/cycles';
import {
  useSubscriptionsQuery,
  useUpdateSubscriptionCycle,
  useCancelSubscription,
  useSkipSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from '@/hooks/useSubscriptions';
import {
  useMyPageSubCycleEdit,
  setSubEditId,
  setSubCycleEdit,
  setCycleDropdownOpen,
  setSkipConfirmSubId,
  setCancelConfirmSubId,
  setPauseConfirmSubId,
} from '@/lib/myPageUiStore';

export function useSubscriptionActions() {
  const { show: toast } = useToast();
  const { subscriptions } = useSubscriptionsQuery();
  const subCycleEdit = useMyPageSubCycleEdit();

  const updateCycleMutation = useUpdateSubscriptionCycle();
  const cancelMutation = useCancelSubscription();
  const skipMutation = useSkipSubscription();
  const pauseMutation = usePauseSubscription();
  const resumeMutation = useResumeSubscription();

  const openSubAccordion = useCallback(
    (sub: { id: string; cycle: SubscriptionCycle }) => {
      setSubEditId(sub.id);
      setSubCycleEdit(sub.cycle);
      setCycleDropdownOpen(false);
    },
    [],
  );

  /* 배송 주기 변경 시 다음 배송일 미리보기 — 서버 PATCH 와 동일 헬퍼 사용 */
  const previewNextDate = useCallback(
    (nextDate: string, oldCycle: SubscriptionCycle, newCycle: SubscriptionCycle): string => {
      if (oldCycle === newCycle) return nextDate;
      const [y, m, d] = nextDate.split('.').map(Number);
      const base = new Date(y, m - 1, d);
      const result = recalculateNextDeliveryOnCycleChange(base, oldCycle, newCycle);
      return `${result.getFullYear()}.${String(result.getMonth() + 1).padStart(2, '0')}.${String(result.getDate()).padStart(2, '0')}`;
    },
    [],
  );

  const saveSubCycle = useCallback(
    (subId: string) => {
      if (!subCycleEdit) return;
      /* paused 상태에서 cycle 변경 시 "재개 후 적용" 안내 — PATCH 전 캡처 */
      const prev = subscriptions.find((s) => s.id === subId);
      const wasPaused = prev?.status === 'paused';
      updateCycleMutation.mutate(
        { id: subId, cycle: subCycleEdit },
        {
          onSuccess: () => {
            setSubEditId(null);
            toast(
              wasPaused
                ? '배송 주기가 변경되었습니다. 재개 시 새 주기로 배송됩니다.'
                : '배송 주기가 변경되었습니다.',
            );
          },
        },
      );
    },
    [subCycleEdit, subscriptions, toast, updateCycleMutation],
  );

  const cancelSub = useCallback(
    (subId: string) => {
      cancelMutation.mutate(subId, {
        onSuccess: () => {
          setSubEditId(null);
          setCancelConfirmSubId(null);
          toast('구독이 해지되었습니다.');
        },
      });
    },
    [cancelMutation, toast],
  );

  const skipDelivery = useCallback(
    (subId: string) => {
      skipMutation.mutate(subId, {
        onSuccess: () => {
          setSkipConfirmSubId(null);
          toast('다음 배송일이 변경되었습니다.');
        },
      });
    },
    [skipMutation, toast],
  );

  const pauseSub = useCallback(
    (subId: string) => {
      pauseMutation.mutate(subId, {
        onSuccess: () => {
          setPauseConfirmSubId(null);
          toast('정기배송이 일시정지되었습니다.');
        },
        onError: () => {
          /* 에러 시에도 모달 close — 사용자 대기 상태 차단 (mutation hook 이 toast 처리). */
          setPauseConfirmSubId(null);
        },
      });
    },
    [pauseMutation, toast],
  );

  const resumeSub = useCallback(
    (subId: string) => {
      resumeMutation.mutate(subId, {
        onSuccess: () => {
          toast('정기배송이 재개되었습니다.');
        },
      });
    },
    [resumeMutation, toast],
  );

  return {
    openSubAccordion,
    previewNextDate,
    saveSubCycle,
    cancelSub,
    skipDelivery,
    pauseSub,
    resumeSub,
  };
}
