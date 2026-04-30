/* ══════════════════════════════════════════
   Subscription Types
   마이페이지 정기배송 관리용
   ══════════════════════════════════════════ */

/** 배송 주기 옵션 — DB enum subscription_period 와 동일 (004_order_items.sql) */
export type SubscriptionCycle = '2주' | '4주' | '6주' | '8주';

export const SUBSCRIPTION_CYCLES: SubscriptionCycle[] = ['2주', '4주', '6주', '8주'];

/** DB enum subscription_status (005_subscriptions.sql) */
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export type Subscription = {
  /** 고유 ID */
  id: string;
  /** 상품 slug (상세 페이지 이동용) */
  slug: string;
  /** 상품명 (한영 병기 원본) */
  name: string;
  /** 용량 (예: "200g") */
  volume: string | null;
  /** 배송 주기 */
  cycle: SubscriptionCycle;
  /** 다음 배송일 (YYYY.MM.DD) */
  nextDate: string;
  /** 구독 상태 */
  status: SubscriptionStatus;
};
