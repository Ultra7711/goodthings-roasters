/* ══════════════════════════════════════════════════════════════════════════
   schemas/payment.ts — 결제 API zod 스키마 (P2-B Session 4 B-3 · Session 6 조정)

   ⚠️ 권위 원칙:
   - 서버가 `orders.total_amount` 기준으로 금액을 재검증한다.
   - 클라이언트에서 오는 `amount` 는 "Toss 가 redirect 한 값" 일 뿐이며,
     조작 가능성이 있으므로 DB 교차검증(§3.1.2) 을 반드시 거친다.

   Session 6 변경:
   - 원시 타입(`PaymentKeySchema` · `OrderNumberSchema` · `AmountSchema`)은
     `schemas/common.ts` 로 이관 (code H-1 DRY 해소).
   - `guestEmail` 옵션 필드 추가 — 게스트 주문의 소유권 교차검증용 (security H-1 / H-3).

   참조:
   - payments-flow.md §3.1 (/api/payments/confirm 스펙)
   - schemas/common.ts
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

import {
  AmountSchema,
  GuestEmailSchema,
  OrderNumberSchema,
  PaymentKeySchema,
} from '@/lib/schemas/common';

/* ── POST /api/payments/confirm 입력 ─────────────────────────────────── */

export const PaymentConfirmSchema = z.object({
  paymentKey: PaymentKeySchema,
  /** Toss successUrl 이 전달하는 orderId = orders.order_number */
  orderId: OrderNumberSchema,
  amount: AmountSchema,
  /**
   * 게스트 주문의 소유권 교차검증용(§3.1 security H-1).
   * - 로그인 유저는 `orders.user_id` 로 소유권 확인하므로 미전달 가능.
   * - 게스트는 체크아웃 시 입력한 이메일을 OrderCompletePage 가 보내고
     서버에서 `orders.guest_email === guestEmail` 로 교차검증한다.
   *
   * 이 필드를 필수로 두지 않는 이유: 레거시(Session 4) 생성 주문이 페이로드
   * 없이 들어올 수 있어 하위 호환성 보존. 검증 실패 시 서비스가 401 로 끊는다.
   */
  guestEmail: GuestEmailSchema.optional(),
});

export type PaymentConfirmInput = z.infer<typeof PaymentConfirmSchema>;
