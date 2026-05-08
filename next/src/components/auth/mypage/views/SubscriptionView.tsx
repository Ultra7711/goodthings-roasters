/* ══════════════════════════════════════════
   SubscriptionView — 정기배송 view (S197 PR-1.3.B)
   기존 SubscriptionEditor 컴포넌트 wrap.
   NextDeliveryCard 가 첫 항목을 별도 강조하므로, 본 view 는 전체 리스트.
   ══════════════════════════════════════════ */

'use client';

import SubscriptionEditor from '../SubscriptionEditor';

export default function SubscriptionView() {
  return <SubscriptionEditor />;
}
