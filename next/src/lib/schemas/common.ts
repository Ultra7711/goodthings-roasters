/* ══════════════════════════════════════════════════════════════════════════
   schemas/common.ts — 결제 도메인 공용 원시 타입 (P2-B Session 6)

   목적:
   - `schemas/payment.ts` 와 `schemas/webhook.ts` 가 각자 `OrderNumberSchema`
     `PaymentKeySchema` 를 중복 선언하던 DRY 위반(code H-1) 해소.
   - 향후 환불 API / 관리자 쿼리 등 새 스키마가 추가될 때 동일 regex·최대 길이·
     에러 메시지를 공유하도록 단일 선언 지점 제공.

   참조:
   - docs/payments-flow.md §3.1 · §3.2.1
   - supabase/migrations/003_orders.sql (order_number 포맷 `GT-YYYYMMDD-NNNNN`)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/**
 * `orders.order_number` — `GT-YYYYMMDD-NNNNN`.
 * 008 enum 과 003 테이블의 포맷과 일치.
 */
export const OrderNumberSchema = z
  .string()
  .regex(/^GT-\d{8}-\d{5}$/, { message: 'invalid_order_number' });

/**
 * Toss paymentKey.
 * 공식 문서가 엄밀한 regex 를 제공하지 않으므로 "영숫자 + `_-`" + 200자 상한으로
 * 보수적으로 정의. 미래 포맷 변경에 대비해 regex 는 느슨하게 유지.
 */
export const PaymentKeySchema = z
  .string()
  .min(1, { message: 'payment_key_required' })
  .max(200, { message: 'payment_key_too_long' })
  .regex(/^[A-Za-z0-9_-]+$/, { message: 'payment_key_invalid_chars' });

/**
 * Toss 금액 — 양의 정수 (원화 단위). 1억원 상한은 체크아웃 UI 에서도 검증하지만
 * 스키마 단계 하드 캡을 둬 악의적 거대 값으로 DB 정수 오버플로우·성능 공격 방지.
 */
export const AmountSchema = z
  .number()
  .int({ message: 'amount_not_integer' })
  .positive({ message: 'amount_not_positive' })
  .max(100_000_000, { message: 'amount_too_large' });

/**
 * 게스트 이메일 — 로그인 사용자 주문은 user_id 로 소유권을 식별하지만,
 * 게스트 주문은 `orders.guest_email` 과 클라이언트가 보낸 값을 교차검증한다.
 * (§3.1 H-3 — Session 6 리뷰 security H-1 반영)
 */
export const GuestEmailSchema = z
  .string()
  .email({ message: 'invalid_guest_email' })
  .max(254, { message: 'guest_email_too_long' });
