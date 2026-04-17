/* ══════════════════════════════════════════════════════════════════════════
   schemas/cart.ts — 장바구니 API zod 스키마 (Session 12)

   원칙:
   - 서버가 권위. 클라이언트는 "무엇을(slug+volume) 얼마나(qty) 어떤 구매방식(type+period)"
     만 전달하고, unit_price_snapshot 은 서버가 PRODUCTS 카탈로그 기준으로 직접 계산 후 저장.
   - order.ts 의 SUBSCRIPTION_PERIODS / OrderItemInputSchema 와 enum 구조 일치.

   참조:
   - supabase/migrations/019_cart_items.sql
   - next/src/lib/schemas/order.ts (OrderItemInputSchema — 동일한 item_type 규칙)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { SUBSCRIPTION_PERIODS } from './order';

/* ── 카트 아이템 입력 (POST /api/cart, merge) ───────────────────────── */

export const CartItemInputSchema = z
  .object({
    productSlug: z.string().min(1).max(80),
    /** 상품 volumes[].label — 서버에서 PRODUCTS 기준으로 단가 스냅샷 계산 */
    volume: z.string().min(1).max(20),
    /** 수량 (order_items 와 동일 — 1..99) */
    quantity: z.number().int().min(1).max(99),
    itemType: z.enum(['normal', 'subscription']).default('normal'),
    subscriptionPeriod: z.enum(SUBSCRIPTION_PERIODS).nullish(),
  })
  .refine(
    (v) =>
      v.itemType === 'normal'
        ? v.subscriptionPeriod == null
        : v.subscriptionPeriod != null,
    {
      path: ['subscriptionPeriod'],
      message: 'required_for_subscription_or_absent_for_normal',
    },
  );

export type CartItemInput = z.infer<typeof CartItemInputSchema>;

/* ── PATCH 수량 변경 ──────────────────────────────────────────────────── */

export const CartItemPatchSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

export type CartItemPatchInput = z.infer<typeof CartItemPatchSchema>;

/* ── 게스트 카트 merge (POST /api/cart/merge) ────────────────────────── */

/**
 * 로그인 직후 localStorage 카트를 DB 로 1회 흡수.
 * 중복 아이템(동일 slug + volume + item_type + period) 은 quantity 합산 (99 상한).
 */
export const CartMergeSchema = z.object({
  items: z.array(CartItemInputSchema).min(1).max(50),
});

export type CartMergeInput = z.infer<typeof CartMergeSchema>;
