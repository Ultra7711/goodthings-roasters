/* ══════════════════════════════════════════
   SubscriptionEditor — 마이페이지 정기배송 관리 (orchestrator)

   S182: 484 LOC → ~145 LOC. 분해 산출물:
   - components/auth/mypage/SubscriptionItem.tsx — 한 아이템 (top + form-reveal + cycle dropdown)
   - components/auth/mypage/CycleDropdown.tsx — 주기 dropdown 패널
   - components/auth/mypage/ConfirmModal.tsx — mp-modal-* 통합 (skip/cancel/pause)
   - hooks/useSubscriptionActions.ts — 7 callbacks 캡슐화
   - hooks/useScrollLockOnModal.ts — body overflow 잠금
   - hooks/useCaptureClickOutside.ts — capture-phase 외부 클릭 닫기
   ══════════════════════════════════════════ */

'use client';

import { extractKrName } from '@/lib/utils';
import { CYCLE_DAYS } from '@/lib/subscription/cycles';
import {
  useSubscriptionsQuery,
} from '@/hooks/useSubscriptions';
import {
  useMyPageSubEditId,
  useMyPageSkipConfirmSubId,
  useMyPageCancelConfirmSubId,
  useMyPagePauseConfirmSubId,
  setSubEditId,
  setSubCycleEdit,
  setSkipConfirmSubId,
  setCancelConfirmSubId,
  setPauseConfirmSubId,
} from '@/lib/myPageUiStore';
import { useScrollLockOnModal } from '@/hooks/useScrollLockOnModal';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import type { Product } from '@/lib/products';
import SubscriptionItem from './SubscriptionItem';
import ConfirmModal from './ConfirmModal';

type Props = {
  /** S267: SubscriptionItem 아코디언 카드 표시용 (category/price/imageBg 매핑) */
  products?: Product[];
};

export default function SubscriptionEditor({ products = [] }: Props) {
  const { subscriptions, isLoading } = useSubscriptionsQuery();

  const subEditId = useMyPageSubEditId();
  const skipConfirmSubId = useMyPageSkipConfirmSubId();
  const cancelConfirmSubId = useMyPageCancelConfirmSubId();
  const pauseConfirmSubId = useMyPagePauseConfirmSubId();

  useScrollLockOnModal(!!skipConfirmSubId || !!cancelConfirmSubId || !!pauseConfirmSubId);

  const {
    openSubAccordion,
    previewNextDate,
    saveSubCycle,
    cancelSub,
    skipDelivery,
    pauseSub,
    resumeSub,
  } = useSubscriptionActions();

  return (
    <>
      <div className="mp-section-body">
        <div className="mp-sub-list">
            {isLoading ? (
              <div className="mp-empty-state">불러오는 중…</div>
            ) : subscriptions.length === 0 ? (
              <div className="mp-empty-state">정기배송 내역이 없습니다.</div>
            ) : (
              subscriptions.map((sub) => {
                const isEditing = subEditId === sub.id;
                const product = products.find((p) => p.slug === sub.slug);
                return (
                  <SubscriptionItem
                    key={sub.id}
                    sub={sub}
                    product={product}
                    isEditing={isEditing}
                    onToggleAccordion={() => {
                      if (isEditing) {
                        setSubEditId(null);
                        setSubCycleEdit(null);
                      } else {
                        openSubAccordion(sub);
                      }
                    }}
                    onCycleSave={() => saveSubCycle(sub.id)}
                    onSkipRequest={() => setSkipConfirmSubId(sub.id)}
                    onCancelRequest={() => setCancelConfirmSubId(sub.id)}
                    onPauseRequest={() => setPauseConfirmSubId(sub.id)}
                    onResume={() => resumeSub(sub.id)}
                    previewNextDate={previewNextDate}
                  />
                );
              })
            )}
        </div>
      </div>

      {skipConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === skipConfirmSubId);
        if (!sub) return null;
        const [ny, nm, nd] = sub.nextDate.split('.').map(Number);
        const nextD = new Date(ny, nm - 1, nd);
        nextD.setDate(nextD.getDate() + (CYCLE_DAYS[sub.cycle] ?? 28));
        const nextDate = `${nextD.getFullYear()}.${String(nextD.getMonth() + 1).padStart(2, '0')}.${String(nextD.getDate()).padStart(2, '0')}`;
        return (
          <ConfirmModal
            title="배송을 건너뛸까요?"
            desc={
              <>
                이번 배송을 건너뛰면 다음 배송일이
                <br />
                <strong>{nextDate}</strong>으로 변경됩니다.
              </>
            }
            confirmLabel="건너뛰기"
            onCancel={() => setSkipConfirmSubId(null)}
            onConfirm={() => skipDelivery(skipConfirmSubId)}
          />
        );
      })()}

      {cancelConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === cancelConfirmSubId);
        if (!sub) return null;
        return (
          <ConfirmModal
            title="구독을 해지할까요?"
            desc={
              <>
                {extractKrName(sub.name)} 정기배송이 해지됩니다.
                <br />
                해지 후에는 복구되지 않습니다.
              </>
            }
            confirmLabel="해지"
            confirmVariant="danger"
            onCancel={() => setCancelConfirmSubId(null)}
            onConfirm={() => cancelSub(cancelConfirmSubId)}
          />
        );
      })()}

      {pauseConfirmSubId && (
        <ConfirmModal
          title="배송을 일시정지할까요?"
          desc={
            <>
              언제든지 재개할 수 있습니다.
              <br />
              일시정지 중에는 배송이 이루어지지 않습니다.
            </>
          }
          confirmLabel="일시정지"
          onCancel={() => setPauseConfirmSubId(null)}
          onConfirm={() => pauseSub(pauseConfirmSubId)}
        />
      )}
    </>
  );
}
