/* ══════════════════════════════════════════════════════════════════════════
   pointService.ts — 적립금(포인트) 순수 비즈 로직 (Phase 1)
   docs/points-implementation-plan.md §6

   역할:
   - 정책(site_settings.points) 기반 적립액·사용 가능액 계산(순수 함수).
   - 클라 표시(U1~U9)와 서버 재계산(orderService·P2)이 동일 규칙을 공유한다.

   원칙:
   - 순수(부수효과 0) — DB 접근 없음. 잔액 변동은 094 RPC(service_role)만.
   - 금액 권위는 항상 서버 재계산(orderService). 본 모듈은 계산 규칙의 단일 정의.
   - 원 단위 정수. 적립은 내림(floor), 사용은 정수만 허용.

   getBalance(잔액 조회)·잔액 변동은 repo/RPC 레이어(Phase 2/5)에서 다룬다 —
   호출처가 생길 때 추가(YAGNI).
   ══════════════════════════════════════════════════════════════════════════ */

import type { PointsSettings } from '@/lib/siteSettings';
import type { RedeemPreview } from '@/types/point';

/**
 * 결제 적립액 계산 — 정책 기반·순수.
 * 마스터 OFF 또는 적립 OFF 면 0. 원 단위 정수(내림).
 *
 * @param subtotal 적립 대상 금액(보통 상품 소계 — 배송비 제외)
 */
export function computeEarnAmount(subtotal: number, policy: PointsSettings): number {
  if (!policy.enabled || !policy.earn.enabled) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return Math.floor(subtotal * policy.earn.rate);
}

/**
 * 행동 트리거 적립액(가입·리뷰·생일) — 정책 기반·순수.
 * 마스터/적립 OFF 또는 해당 트리거 OFF 면 0.
 */
export function computeTriggerEarn(
  trigger: 'signup' | 'review' | 'birthday',
  policy: PointsSettings,
): number {
  if (!policy.enabled || !policy.earn.enabled) return 0;
  const t = policy.earn.triggers[trigger];
  return t.enabled ? t.amount : 0;
}

/**
 * 사용 미리보기 — 요청·잔액·결제액·정책을 종합한 실제 사용 가능액·결제 예상액.
 * 순수. UI(U3) 표시와 서버 검증(T1)이 동일 결과를 내도록 공유한다.
 *
 * 한도 = min(요청, 잔액, 결제액, 결제액×max_ratio).
 * 사용 가능액이 최소 사용액(min) 미만이면 사용 불가(below_min).
 *
 * @param requested    사용자가 입력한 사용 희망 포인트
 * @param balance      보유 잔액
 * @param payableTotal 포인트 적용 대상 결제액(상품 소계 + 배송비 등)
 */
export function previewRedeem(
  requested: number,
  balance: number,
  payableTotal: number,
  policy: PointsSettings,
): RedeemPreview {
  if (!policy.enabled || !policy.redeem.enabled) {
    return { usable: 0, payable: payableTotal, reason: 'disabled' };
  }
  if (!Number.isFinite(balance) || balance <= 0) {
    return { usable: 0, payable: payableTotal, reason: 'no_balance' };
  }

  const req = Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : 0;
  const maxByRatio = Math.floor(Math.max(0, payableTotal) * policy.redeem.max_ratio);
  const cap = Math.min(balance, Math.max(0, payableTotal), maxByRatio);
  const usable = Math.min(req, cap);

  if (usable < policy.redeem.min) {
    return { usable: 0, payable: payableTotal, reason: 'below_min' };
  }

  return { usable, payable: payableTotal - usable, reason: null };
}
