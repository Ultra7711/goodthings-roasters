/* ══════════════════════════════════════════
   Subscription Types
   마이페이지 정기배송 관리용
   ══════════════════════════════════════════ */

/* SubscriptionCycle · SUBSCRIPTION_CYCLES 는 lib/subscription/cycles.ts 가 SoT (S165).
   기존 import 호환을 위해 re-export. */
export type { SubscriptionCycle } from '@/lib/subscription/cycles';
export { SUBSCRIPTION_CYCLES } from '@/lib/subscription/cycles';

import type { SubscriptionCycle } from '@/lib/subscription/cycles';

/** DB enum subscription_status (005_subscriptions.sql) */
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

/**
 * 결제수단 연결 상태 (R-3d · DEC-S339-3·4).
 * - ok: billing_method 유효(존재 + 미삭제)
 * - detached: billing_method_id NULL 또는 가리키는 카드 soft-deleted → 재등록 필수
 * - payment_failed: 유효 카드인데 paused + 미해결 실패 큐(dunning·영구실패) → 재등록 권장
 */
export type SubscriptionBillingStatus = 'ok' | 'detached' | 'payment_failed';

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
  /** 상품 대표 이미지 (S197 PR-2 §2.6) — NextDeliveryCard 노출 */
  imageUrl: string | null;
  /**
   * 결제수단 상태 (R-3d). 목록 조회 경로(마이페이지 prefetch · GET /api/subscriptions)
   * 에서만 채운다. mutation 단건 응답엔 미포함(undefined) — 직후 invalidate refetch 로 정확값.
   * undefined 는 UI 에서 'ok'(경고 미표시) 로 취급.
   */
  billingStatus?: SubscriptionBillingStatus;
};
