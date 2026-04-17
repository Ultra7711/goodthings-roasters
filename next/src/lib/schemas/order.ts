/* ══════════════════════════════════════════════════════════════════════════
   schemas/order.ts — 주문 API zod 스키마 (P2-A-1)

   원칙:
   - 서버가 권위(source of truth). 클라이언트는 "무엇을(slug+volume) 얼마나(qty)"
     만 전달하고 단가·소계·배송비·총액은 서버가 PRODUCTS 카탈로그 기반으로 재계산한다.
   - 이 파일은 입력 형태만 검증. 비즈 규칙은 services/orderService.ts.

   참조:
   - supabase/migrations/003_orders.sql (CHECK 제약)
   - supabase/migrations/004_order_items.sql (enum · CHECK)
   - docs/backend-architecture-plan.md §7.3 (검증 패턴)
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/* ── 공통 primitive ────────────────────────────────────────────────────── */

/** 010-1234-5678 (하이픈 포함) — 프로토타입 usePhoneFormat 출력 형식 */
const PhoneSchema = z
  .string()
  .regex(/^\d{2,3}-\d{3,4}-\d{4}$/, { message: 'invalid_phone' });

/** 한국 우편번호 5자리 */
const ZipcodeSchema = z
  .string()
  .regex(/^\d{5}$/, { message: 'invalid_zipcode' });

/** RFC 5321 로컬+도메인 상한 근사치 */
const EmailSchema = z.string().email({ message: 'invalid_email' }).max(255);

/* ── 주문 아이템 (클라 → 서버) ─────────────────────────────────────────── */

/** 004_order_items.sql subscription_period enum 과 완전 동일 */
export const SUBSCRIPTION_PERIODS = ['2주', '4주', '6주', '8주'] as const;
export type SubscriptionPeriod = (typeof SUBSCRIPTION_PERIODS)[number];

export const OrderItemInputSchema = z
  .object({
    productSlug: z.string().min(1).max(80),
    /** 상품의 volumes[].label — 서버에서 PRODUCTS 로부터 단가 조회 */
    volume: z.string().min(1).max(20),
    /** 수량 (상한은 UX 관점 99 — 상품당 대량 주문 방지) */
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

export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;

/* ── 배송지 ──────────────────────────────────────────────────────────── */

export const ShippingSchema = z
  .object({
    name: z.string().min(1).max(80),
    phone: PhoneSchema,
    zipcode: ZipcodeSchema,
    addr1: z.string().min(1).max(200),
    /** 상세주소 — 빈 문자열 허용, 트림 필요 */
    addr2: z.string().max(200).default(''),
    /** 프리셋 코드 (프로토타입 DELIVERY_OPTIONS.value) */
    messageCode: z.string().max(20).nullish(),
    /** 직접입력 (프리셋이 'direct' 일 때) */
    messageCustom: z.string().max(200).nullish(),
  })
  .refine((v) => !(v.messageCode && v.messageCustom), {
    path: ['messageCustom'],
    message: 'code_and_custom_exclusive',
  });

export type ShippingInput = z.infer<typeof ShippingSchema>;

/* ── 결제수단 ────────────────────────────────────────────────────────── */

export const PaymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('card') }),
  z.object({
    method: z.literal('transfer'),
    bankName: z.string().min(1).max(30),
    depositorName: z.string().min(1).max(50),
  }),
]);

export type PaymentInput = z.infer<typeof PaymentSchema>;

/* ── 약관 동의 ───────────────────────────────────────────────────────── */

/** 필수 2종: 이용약관 + 개인정보. literal(true) 로 동의 없이는 검증 실패. */
export const AgreementSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
});

/* ── 게스트 ──────────────────────────────────────────────────────────── */

/** 프로토타입 guestPw 최소 4자 — 이 값은 서버에서 argon2 해시 후 저장. */
export const GUEST_PIN_MIN = 4;
export const GUEST_PIN_MAX = 16;

const GuestPinSchema = z
  .string()
  .min(GUEST_PIN_MIN, { message: 'pin_too_short' })
  .max(GUEST_PIN_MAX, { message: 'pin_too_long' })
  .regex(/\S/, { message: 'pin_whitespace_only' });

/* ── 주문 생성 입력 ──────────────────────────────────────────────────── */

export const OrderCreateSchema = z.object({
  items: z.array(OrderItemInputSchema).min(1).max(50),
  shipping: ShippingSchema,
  payment: PaymentSchema,
  contactEmail: EmailSchema,
  contactPhone: PhoneSchema,
  agreement: AgreementSchema,
  /** 약관 버전 문자열 (예: '2026-04-01') — 증빙용 */
  termsVersion: z.string().min(1).max(20),
  /**
   * 게스트 주문일 때 제공. 회원 주문이면 서버에서 무시(로그 후 null 처리).
   * null/undefined 모두 허용.
   */
  guest: z
    .object({
      pin: GuestPinSchema,
    })
    .nullish(),
});

export type OrderCreateInput = z.infer<typeof OrderCreateSchema>;

/* ── 게스트 주문 조회 입력 (A-4) ──────────────────────────────────────── */

/** GT-YYYYMMDD-NNNNN[N] 포맷 (011_orders_hardening.sql orders_number_format `{5,6}`).
    일일 시퀀스가 100,000 건을 초과하면 6자리 확장 (modulo 1,000,000). */
export const OrderNumberSchema = z
  .string()
  .regex(/^GT-\d{8}-\d{5,6}$/, { message: 'invalid_order_number' });

/**
 * 게스트 주문 조회 입력 (POST /api/orders/guest-lookup).
 *
 * - `orderNumber` + `email` 로 주문 특정 → `pin` argon2 verify 로 권한 확인.
 * - PIN 불일치/주문 미존재 모두 동일 응답(404 + 타이밍 상수)으로 enumeration 방어.
 * - Rate limiting (`guest_pin`, 5 req / 10 min) 과 조합하여 브루트포스 차단.
 */
export const GuestLookupSchema = z.object({
  orderNumber: OrderNumberSchema,
  email: EmailSchema,
  pin: GuestPinSchema,
});

export type GuestLookupInput = z.infer<typeof GuestLookupSchema>;
