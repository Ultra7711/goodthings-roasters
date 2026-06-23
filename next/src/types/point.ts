/* ══════════════════════════════════════════
   Point Types — 적립금(포인트) 시스템 (Phase 1)
   docs/points-implementation-plan.md §6
   ══════════════════════════════════════════ */

import type { DbPointEventType, DbPointSource } from '@/types/db';

/** 원장 이벤트 종류 (090_points_schema.sql) */
export type PointEventType = DbPointEventType;

/** 변동 사유 카테고리 (090_points_schema.sql) */
export type PointSource = DbPointSource;

/** 포인트 원장 항목 (앱 camelCase — DB point_ledger 행 매핑) */
export type PointLedgerEntry = {
  id: string;
  userId: string;
  /** 결제 적립/사용의 주문 연결. 행동 적립은 null */
  orderId: string | null;
  eventType: PointEventType;
  source: PointSource;
  /** earned/reversed=양수, used/expired=음수, adjusted=양/음 */
  amount: number;
  /** DEC-P3 만료 구조 지원. 초기 무만료 → null */
  expiresAt: string | null;
  description: string | null;
  createdAt: string;
};

/**
 * 포인트 변동 RPC 반환 (earn/use/reverse/adjust_points → jsonb)
 * applied=false → 멱등 중복(이미 처리됨)
 */
export type PointMutationResult = {
  applied: boolean;
  ledgerId: string | null;
  balance: number;
};

/** 사용 미리보기 결과 (previewRedeem) */
export type RedeemPreview = {
  /** 실제 사용 가능한 포인트(요청·잔액·결제액·정책 min 종합) */
  usable: number;
  /** 사용 후 결제 예상액 */
  payable: number;
  /** 사용 불가 사유(있으면) — UI 안내용 */
  reason: 'below_min' | 'no_balance' | 'disabled' | null;
};
