/* ══════════════════════════════════════════════════════════════════════════
   orderService.ts — 주문 비즈 로직 (P2-A)

   역할:
   - 권위(source of truth) 보장: 클라이언트가 보낸 가격은 전부 버리고
     PRODUCTS 카탈로그 기준으로 재계산.
   - 배송비 규칙 동일 적용 (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE).
   - 게스트 주문 PIN argon2id 해시.
   - 게스트/회원 분기는 Route Handler 에서 결정 → 서비스는 주어진 userId 로만 동작.

   원칙:
   - repo 호출 이전에 모든 비즈 규칙·계산·해시를 완료한다.
   - 서비스는 Response/Next 관련 객체를 알지 못한다 (Route Handler 책임).

   참조:
   - docs/backend-architecture-plan.md §7.2 (레이어 분리)
   - lib/store.ts FREE_SHIPPING_THRESHOLD / SHIPPING_FEE (단일 소스)
   ══════════════════════════════════════════════════════════════════════════ */

import { hash as argon2Hash } from '@node-rs/argon2';
import { PRODUCTS, type Product, type ProductVolume } from '@/lib/products';
import {
  createOrder as createOrderRpc,
  type CreateOrderRpcItem,
  type CreateOrderRpcResult,
} from '@/lib/repositories/orderRepo';
import type {
  OrderCreateInput,
  OrderItemInput,
} from '@/lib/schemas/order';

/* ── 배송비 상수 (서버 단독 소스) ──────────────────────────────────────
   BUG-FIX 2026-04-23: @/hooks/useCart · @/lib/cartCalc 등 외부 모듈에서
   import 한 상수·함수가 Vercel Turbopack 프로덕션 번들에서 함수 객체로 치환되는
   버그 확인 (PGRST202 → toInt fallback 은폐 → 총액 배송비 누락). 외부 의존
   전부 제거하고 이 파일에 리터럴 상수로 고정. 값은 hooks/useCart.ts 의
   FREE_SHIPPING_THRESHOLD(30000) / SHIPPING_FEE(3000) 과 동일 정책.
   정책 변경 시 두 곳 동기화 필수. */
const ORDER_FREE_SHIPPING_THRESHOLD = 30000;
const ORDER_SHIPPING_FEE = 3000;

/* calcShippingFee 는 @/lib/cartCalc 로 이관 완료.
   이 파일은 calcShippingFee 심볼을 직접 import/re-export 하지 않는다 —
   Vercel Turbopack 프로덕션 번들에서 이 심볼이 식별되면 동일 파일 내 다른
   변수(특히 배송비 계산 결과)가 함수 객체로 치환되는 버그가 발생하기 때문.
   test 파일은 cartCalc 원본 모듈에서 직접 import. */

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

/** argon2id 파라미터 (OWASP 2026 권장 — 메모리 19MB / 반복 2 / 병렬 1) */
export const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/* ══════════════════════════════════════════
   에러 — 도메인 레벨
   ══════════════════════════════════════════ */

/**
 * 주문 생성 중 발생하는 도메인 에러.
 * Route Handler 에서 code 로 분기 → apiError 매핑.
 */
export class OrderServiceError extends Error {
  readonly code: OrderServiceErrorCode;
  readonly detail?: string;

  constructor(code: OrderServiceErrorCode, detail?: string) {
    super(code);
    this.name = 'OrderServiceError';
    this.code = code;
    this.detail = detail;
  }
}

export type OrderServiceErrorCode =
  | 'product_not_found'
  | 'volume_not_found'
  | 'volume_sold_out'
  | 'subscription_not_allowed'
  | 'guest_pin_required'
  | 'guest_email_required';

/* ══════════════════════════════════════════
   순수 계산 유틸 (테스트 대상)
   ══════════════════════════════════════════ */

/** PRODUCTS 에서 slug 로 상품 1건 탐색. 없으면 throw. */
export function resolveProduct(slug: string): Product {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) {
    throw new OrderServiceError('product_not_found', slug);
  }
  return product;
}

/** 상품 내 volume(label) 조회. 없으면 throw. */
export function resolveVolume(product: Product, volume: string): ProductVolume {
  const found = product.volumes.find((v) => v.label === volume);
  if (!found) {
    throw new OrderServiceError(
      'volume_not_found',
      `${product.slug}:${volume}`,
    );
  }
  if (found.soldOut) {
    throw new OrderServiceError(
      'volume_sold_out',
      `${product.slug}:${volume}`,
    );
  }
  return found;
}

/**
 * 클라 입력 1건 → 서버 권위 가격으로 재구성된 RPC 입력 아이템.
 * 정기배송 여부 · 가격 · 스냅샷 필드 세팅.
 */
export function buildRpcItem(input: OrderItemInput): CreateOrderRpcItem {
  const product = resolveProduct(input.productSlug);

  if (input.itemType === 'subscription' && !product.subscription) {
    throw new OrderServiceError('subscription_not_allowed', product.slug);
  }

  const volume = resolveVolume(product, input.volume);

  /* M2: 현재 할인 정책이 없으므로 원가 = 할인가.
     추후 subscription_discount 등 도입 시 여기서 unit_price 조정. */
  const unitPrice = volume.price;
  const originalUnitPrice = volume.price;
  const lineTotal = unitPrice * input.quantity;

  const image = product.images[0] ?? null;

  return {
    product_slug: product.slug,
    product_name: product.name,
    product_category: product.category,
    product_volume: volume.label,
    product_image_src: image?.src ?? '',
    product_image_bg: image?.bg ?? '',
    quantity: input.quantity,
    unit_price: unitPrice,
    original_unit_price: originalUnitPrice,
    line_total: lineTotal,
    item_type: input.itemType,
    subscription_period: input.subscriptionPeriod ?? null,
  };
}

/**
 * 아이템 배열 → 서버 권위 RPC 아이템 배열 + 소계.
 * 호출자 편의를 위해 두 값을 한번에 반환.
 */
export function recomputeItems(items: OrderItemInput[]): {
  rpcItems: CreateOrderRpcItem[];
  subtotal: number;
} {
  const rpcItems = items.map(buildRpcItem);
  const subtotal = rpcItems.reduce((sum, it) => sum + it.line_total, 0);
  return { rpcItems, subtotal };
}

/* ══════════════════════════════════════════
   argon2id 래퍼
   ══════════════════════════════════════════ */

/** 게스트 PIN 해시. argon2id + OWASP 2026 파라미터. */
export async function hashGuestPin(pin: string): Promise<string> {
  return argon2Hash(pin, {
    algorithm: 2, // 2 = Argon2id (from @node-rs/argon2)
    memoryCost: ARGON2_OPTS.memoryCost,
    timeCost: ARGON2_OPTS.timeCost,
    parallelism: ARGON2_OPTS.parallelism,
  });
}

/* ══════════════════════════════════════════
   메인 엔트리 — createOrderFromInput
   ══════════════════════════════════════════ */

export type CreateOrderContext = {
  /** 로그인 유저 id (null 이면 게스트) */
  userId: string | null;
  /** 게스트 주문 시 조회용 email — userId 가 null 이면 필수 */
  guestEmail: string | null;
};

/**
 * Route Handler 에서 호출하는 진입점.
 *
 * 흐름:
 *  1) 가격/아이템 재계산 (PRODUCTS 기반)
 *  2) 배송비 계산
 *  3) 게스트면 PIN argon2 해시
 *  4) 원자 RPC createOrder 호출
 *
 * @throws OrderServiceError — 클라가 보낸 상품 정보가 카탈로그와 불일치
 * @throws Error             — DB 오류 (호출자가 apiError('server_error') 매핑)
 */
export async function createOrderFromInput(
  input: OrderCreateInput,
  ctx: CreateOrderContext,
): Promise<CreateOrderRpcResult> {
  /* 0) 게스트 조건 검증 */
  if (ctx.userId == null) {
    if (!ctx.guestEmail) {
      throw new OrderServiceError('guest_email_required');
    }
    if (!input.guest?.pin) {
      throw new OrderServiceError('guest_pin_required');
    }
  }

  /* 1) 서버 권위 재계산 */
  const { rpcItems, subtotal } = recomputeItems(input.items);

  /* 2) 배송비 / 총액 — 이 파일 내 로컬 상수 사용 (외부 import 없음, 위 주석 참조) */
  const shippingFeeAmount =
    subtotal === 0 || subtotal >= ORDER_FREE_SHIPPING_THRESHOLD
      ? 0
      : ORDER_SHIPPING_FEE;
  const discountAmount = 0; // 프로모션 도입 시 확장
  const totalAmount = subtotal + shippingFeeAmount - discountAmount;

  /* 3) PIN 해시 (게스트만) */
  const guestPinHash =
    ctx.userId == null && input.guest?.pin
      ? await hashGuestPin(input.guest.pin)
      : null;

  /* 4) 결제수단 분기 */
  const bankName =
    input.payment.method === 'transfer' ? input.payment.bankName : null;
  const depositorName =
    input.payment.method === 'transfer' ? input.payment.depositorName : null;

  /* 5) RPC 호출 */
  return createOrderRpc({
    userId: ctx.userId,
    guestEmail: ctx.userId == null ? ctx.guestEmail : null,
    guestPinHash,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    shipping: {
      name: input.shipping.name,
      phone: input.shipping.phone,
      zipcode: input.shipping.zipcode,
      addr1: input.shipping.addr1,
      addr2: input.shipping.addr2,
      messageCode: input.shipping.messageCode ?? null,
      messageCustom: input.shipping.messageCustom ?? null,
    },
    payment: {
      method: input.payment.method,
      bankName,
      depositorName,
    },
    subtotal,
    shippingFee: shippingFeeAmount,
    discountAmount,
    totalAmount,
    termsVersion: input.termsVersion,
    items: rpcItems,
  });
}
