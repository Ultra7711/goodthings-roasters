/* ══════════════════════════════════════════════════════════════════════════
   orderClient.ts — 클라이언트 측 주문 API 래퍼 (P2-A-5)

   역할:
   - CheckoutPage 에서 `POST /api/orders` 호출에 필요한 페이로드 빌드 + fetch.
   - 서버 권위 원칙에 따라 가격·총액 필드는 전송하지 않는다.
   - 에러는 `OrderApiError` 로 표준화하여 UI 가 toast 로 처리할 수 있게 한다.

   흐름:
   1) buildOrderPayload(form, cart, isLoggedIn) → OrderCreateInput
   2) createOrder(payload) → { id, orderNumber, totalAmount }
   3) 실패 시 서버의 error code 를 OrderApiError.code 로 승격

   참조:
   - src/lib/schemas/order.ts (OrderCreateSchema)
   - src/app/api/orders/route.ts (엔드포인트)
   ══════════════════════════════════════════════════════════════════════════ */

import type { CheckoutFormData } from '@/types/checkout';
import type { CartItem } from '@/types/cart';
import type { OrderCreateInput } from '@/lib/schemas/order';
import { CHECKOUT_TERMS_VERSION } from '@/lib/constants';

/* ── 응답 타입 ──────────────────────────────────────────────────────── */

export type CreateOrderResponse = {
  id: string;
  orderNumber: string;
  totalAmount: number;
};

/** 서버 에러 응답을 감싸 UI 로 전달하는 커스텀 에러 */
export class OrderApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: string;
  readonly fields?: Record<string, string[] | undefined>;
  readonly retryAfter?: number;

  constructor(opts: {
    code: string;
    status: number;
    detail?: string;
    fields?: Record<string, string[] | undefined>;
    retryAfter?: number;
  }) {
    super(opts.code);
    this.name = 'OrderApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.detail = opts.detail;
    this.fields = opts.fields;
    this.retryAfter = opts.retryAfter;
  }
}

/* ── 페이로드 빌더 ──────────────────────────────────────────────────── */

/** 배송 메시지 프리셋 중 "직접 입력" 트리거 값 */
const DELIVERY_CUSTOM_MARKER = 'direct';

/**
 * 체크아웃 폼 + 장바구니 → API 입력 페이로드.
 *
 * - 가격·총액 필드는 전혀 포함하지 않는다 (서버 재계산).
 * - 게스트 주문: isLoggedIn=false 일 때 guest.pin 포함.
 * - deliveryMessage === 'direct' → messageCode=null, messageCustom=deliveryCustom
 *
 * Pass 1 CODE/H-3: agreement 값은 실제 사용자 체크 상태에서 유도한다.
 * (이전에는 `{ terms: true, privacy: true }` 하드코딩이었음 → 무결성 누설 리스크)
 * agreements 배열 인덱스 — [0]=이용약관(terms), [1]=개인정보(privacy).
 *
 * 방어 2 겹:
 * 1) 이 함수는 두 값이 모두 true 가 아니면 {@link OrderApiError}('agreement_required')
 *    를 throw 한다 — CheckoutPage `validate()` 에서 먼저 막혀야 하지만 회귀 방어용.
 * 2) 서버 {@link OrderCreateSchema} 는 `literal(true)` 를 요구한다 (= 방어 2 겹).
 *
 * @throws OrderApiError — 필수 약관 미동의 상태로 호출된 경우 (방어적)
 */
export function buildOrderPayload(
  form: CheckoutFormData,
  items: CartItem[],
  isLoggedIn: boolean,
  agreements: readonly boolean[],
): OrderCreateInput {
  /* Pass 1 CODE/H-3: 방어적 invariant — validate() 가 이미 걸러야 함 */
  if (agreements[0] !== true || agreements[1] !== true) {
    throw new OrderApiError({
      code: 'agreement_required',
      status: 0,
      detail: 'terms_or_privacy_not_accepted',
    });
  }

  /* 배송 메시지 매핑 */
  let messageCode: string | null = null;
  let messageCustom: string | null = null;
  const deliveryTrimmed = form.deliveryMessage?.trim() ?? '';
  if (deliveryTrimmed === DELIVERY_CUSTOM_MARKER) {
    const custom = form.deliveryCustom?.trim() ?? '';
    messageCustom = custom.length > 0 ? custom : null;
  } else if (deliveryTrimmed.length > 0) {
    messageCode = deliveryTrimmed;
  }

  /* 아이템 매핑 — slug/volume/qty/type/period 만 */
  const payloadItems: OrderCreateInput['items'] = items.map((item) => ({
    productSlug: item.slug,
    volume: item.volume ?? '',
    quantity: item.qty,
    itemType: item.type,
    subscriptionPeriod:
      item.type === 'subscription' && item.period
        ? (item.period as OrderCreateInput['items'][number]['subscriptionPeriod'])
        : null,
  }));

  /* 결제수단 분기 */
  const payment: OrderCreateInput['payment'] =
    form.paymentMethod === 'transfer'
      ? {
          method: 'transfer',
          bankName: form.bankName.trim(),
          depositorName: form.depositorName.trim(),
        }
      : { method: 'card' };

  const base: OrderCreateInput = {
    items: payloadItems,
    shipping: {
      name: form.firstname.trim(),
      phone: form.phone.trim(),
      zipcode: form.zipcode.trim(),
      addr1: form.addr1.trim(),
      addr2: form.addr2.trim(),
      messageCode,
      messageCustom,
    },
    payment,
    contactEmail: form.email.trim(),
    contactPhone: form.phone.trim(),
    /* 위 invariant 로 두 값이 true 임이 검증되었으므로 literal 로 단언.
       서버 zod literal(true) 가 최종 검증. */
    agreement: { terms: true, privacy: true },
    termsVersion: CHECKOUT_TERMS_VERSION,
    guest: isLoggedIn ? null : { pin: form.guestPw },
  };

  return base;
}

/* ── API 호출 ───────────────────────────────────────────────────────── */

type ApiErrorBody = {
  error?: string;
  detail?: string;
  fields?: Record<string, string[] | undefined>;
  retryAfter?: number;
};

/**
 * POST /api/orders
 *
 * @throws OrderApiError — 서버가 2xx 이외를 반환하거나 네트워크 오류일 때
 */
export async function createOrder(
  payload: OrderCreateInput,
  init?: { signal?: AbortSignal },
): Promise<CreateOrderResponse> {
  let res: Response;
  try {
    res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: init?.signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    /* 네트워크 장애 */
    throw new OrderApiError({
      code: 'network_error',
      status: 0,
      detail: err instanceof Error ? err.message : 'fetch_failed',
    });
  }

  if (!res.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* 비-JSON 응답 */
    }
    throw new OrderApiError({
      code: body.error ?? 'server_error',
      status: res.status,
      detail: body.detail,
      fields: body.fields,
      retryAfter: body.retryAfter,
    });
  }

  /* 성공: { data: CreateOrderResponse } */
  const json = (await res.json()) as { data?: CreateOrderResponse };
  if (!json.data?.orderNumber) {
    throw new OrderApiError({
      code: 'invalid_response',
      status: res.status,
      detail: 'missing_order_number',
    });
  }
  return json.data;
}
