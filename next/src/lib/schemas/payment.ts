/* ══════════════════════════════════════════════════════════════════════════
   schemas/payment.ts — 결제 API zod 스키마 (P2-B Session 4 B-3)

   ⚠️ 권위 원칙:
   - 서버가 `orders.total_amount` 기준으로 금액을 재검증한다.
   - 클라이언트에서 오는 `amount` 는 "Toss 가 redirect 한 값" 일 뿐이며,
     조작 가능성이 있으므로 DB 교차검증(§3.1.2) 을 반드시 거친다.

   참조:
   - payments-flow.md §3.1 (/api/payments/confirm 스펙)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── Toss paymentKey 형식 ───────────────────────────────────────────────
   Toss paymentKey 는 200자 이내의 영숫자(underscore 포함) 문자열.
   공식 문서가 엄밀한 regex 를 제공하지 않으므로 보수적으로 200자 상한 +
   "영숫자+`_-`" 만 허용한다. 미래 포맷 변경에 대비해 regex 는 느슨하게.
*/
const PaymentKeySchema = z
  .string()
  .min(1, { message: 'payment_key_required' })
  .max(200, { message: 'payment_key_too_long' })
  .regex(/^[A-Za-z0-9_-]+$/, { message: 'payment_key_invalid_chars' });

/** `GT-YYYYMMDD-NNNNN` — orders.order_number 와 동일 */
const OrderNumberSchema = z
  .string()
  .regex(/^GT-\d{8}-\d{5}$/, { message: 'invalid_order_number' });

/** Toss 금액 — 양의 정수 (원화 단위) */
const AmountSchema = z
  .number()
  .int({ message: 'amount_not_integer' })
  .positive({ message: 'amount_not_positive' })
  .max(100_000_000, { message: 'amount_too_large' });

/* ── POST /api/payments/confirm 입력 ─────────────────────────────────── */

export const PaymentConfirmSchema = z.object({
  paymentKey: PaymentKeySchema,
  /** Toss successUrl 이 전달하는 orderId = orders.order_number */
  orderId: OrderNumberSchema,
  amount: AmountSchema,
});

export type PaymentConfirmInput = z.infer<typeof PaymentConfirmSchema>;
