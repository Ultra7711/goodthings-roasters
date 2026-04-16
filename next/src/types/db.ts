/* ══════════════════════════════════════════════════════════════════════════
   types/db.ts — DB enum 미러 타입 (P2-A)

   목적:
   - Supabase PostgreSQL enum 과 TypeScript literal union 을 수기 동기화.
   - Supabase CLI 의 `supabase gen types typescript` 대신,
     마이그레이션 변경 시 본 파일을 직접 수정하는 정책.
     (이유: 프로젝트 규모 작음 + 엔터프라이즈 워크플로우 오버헤드 회피)

   동기화 대상:
   - 003_orders.sql          → OrderStatus, PaymentMethod
   - 004_order_items.sql     → OrderItemType, SubscriptionPeriod
   - 005_subscriptions.sql   → SubscriptionStatus (P2-C 에서 활성화)
   - 006_payment_transactions.sql → PaymentEventType (P2-B 에서 활성화)

   네이밍:
   - Db* 접두어: DB enum 그대로 (프론트 표시용 OrderStatus 와 구분).
   - 프론트 표시용 (한글) 타입은 types/order.ts 의 OrderStatus 를 사용한다.
   ══════════════════════════════════════════════════════════════════════════ */

/** 003_orders.sql public.order_status */
export type DbOrderStatus =
  | 'pending'
  | 'paid'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refund_processing'
  | 'refunded';

/** 003_orders.sql public.payment_method */
export type DbPaymentMethod = 'card' | 'transfer';

/** 004_order_items.sql public.order_item_type */
export type OrderItemType = 'normal' | 'subscription';

/** 004_order_items.sql public.subscription_period */
export type DbSubscriptionPeriod = '2주' | '4주' | '6주' | '8주';
