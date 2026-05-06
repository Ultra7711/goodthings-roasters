/* ══════════════════════════════════════════════════════════════════════════
   subscription/cycles.ts — 정기배송 주기 단일 진실 출처 (S165)

   목적:
   - subscription_period enum (DB 004) 의 4값 (`'2주'·'4주'·'6주'·'8주'`) 과
     주기-일수 매핑 (14/28/42/56) 을 한 곳에서 정의·export.
   - 변경 시 본 파일만 수정 → 호출처 자동 정합.

   설계:
   - `DbSubscriptionPeriod` (types/db.ts) 가 type SoT — DB enum mirror 정책 유지.
   - 본 파일이 runtime SoT — `SUBSCRIPTION_CYCLES` tuple + `CYCLE_DAYS` 매핑.
   - `_ExhaustiveCheck` 로 DB enum 추가 시 컴파일 에러 발생 → 동기화 누락 방지.

   호출처 (S165 PR-3 정합 후):
   - components/auth/mypage/SubscriptionEditor.tsx
   - lib/repositories/subscriptionRepo.ts
   - lib/repositories/cartRepo.ts
   - app/api/subscriptions/[id]/route.ts (zod schema)
   - lib/schemas/order.ts (z.enum 직접 호출)
   - lib/schemas/cart.ts (z.enum 직접 호출)
   - hooks/useCart.ts (z.enum 직접 호출 + SubscriptionCycle 타입)
   - types/subscription.ts (re-export — Subscription 타입 호환)

   carry-over: ADR-005 lookup 테이블 (어드민 cycle 편집) — 별 sprint.
   ══════════════════════════════════════════════════════════════════════════ */

import type { DbSubscriptionPeriod } from '@/types/db';

/** UI 측 도메인 alias — DB column `subscriptions.cycle` 명 미러. */
export type SubscriptionCycle = DbSubscriptionPeriod;

/**
 * runtime tuple — Zod schema · UI dropdown · 검증 모두 본 배열을 import.
 * `as const satisfies` 로 DB enum 4값 정합 강제.
 */
export const SUBSCRIPTION_CYCLES = [
  '2주',
  '4주',
  '6주',
  '8주',
] as const satisfies readonly DbSubscriptionPeriod[];

/**
 * Exhaustive check — DB enum 에 새 값 추가 시 컴파일 에러.
 * never 가 아니면 `Exclude` 가 union 일부를 남긴다 → 본 tuple 갱신 누락 의미.
 */
type _ExhaustiveCheck = Exclude<
  DbSubscriptionPeriod,
  (typeof SUBSCRIPTION_CYCLES)[number]
> extends never
  ? true
  : never;
// 컴파일러 사용 (export 안 함) — 위 타입이 never 면 다음 라인이 type error
const _exhaustiveOk: _ExhaustiveCheck = true;
void _exhaustiveOk;

/**
 * 주기 → 일수 매핑.
 * - 026_create_order_subscription_insert.sql 의 case when 과 동일.
 * - 본 매핑 수정 시 026 마이그레이션 + RPC 도 함께 업데이트해야 함.
 */
export const CYCLE_DAYS = {
  '2주': 14,
  '4주': 28,
  '6주': 42,
  '8주': 56,
} as const satisfies Record<SubscriptionCycle, number>;

/** 안전 헬퍼 — known cycle 만 받음. unknown 입력은 호출 측에서 narrowing 후 사용. */
export function getCycleDays(cycle: SubscriptionCycle): number {
  return CYCLE_DAYS[cycle];
}
