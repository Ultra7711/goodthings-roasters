/* ══════════════════════════════════════════════════════════════════════════
   tossBillingClient.ts — TossPayments 자동결제(빌링) API 클라이언트 (Phase 3-A)

   역할:
   - `POST /v1/billing/authorizations/issue` — authKey → billingKey 발급
   - `POST /v1/billing/{billingKey}` — 자동결제 승인 (첫 회차 + cron cycle)
   - tossClient.ts 의 tossFetch wrapper 재사용 (Basic Auth + timeout + 1회 재시도)

   서버 전용:
   - 클라이언트 번들 유입 시 TOSS_SECRET_KEY 노출. tossFetch 가 module-top 에서 차단.

   보안:
   - billingKey 는 평생 토큰 (재조회 불가). 응답 받으면 호출자가 즉시 DB 저장.
   - billingKey 를 로깅 / Sentry / 클라이언트 응답에 노출 금지.
   - 응답 raw 는 결제 추적 목적으로만 저장 (billing_methods.billing_key 외 별도 테이블 운영 시).

   참조:
   - docs/adr/ADR-008-toss-billing-integration.md §3.1, §3.2
   - https://docs.tosspayments.com/reference (자동결제 승인)
   - https://docs.tosspayments.com/guides/billing/overview
   ══════════════════════════════════════════════════════════════════════════ */

import { tossFetch } from './tossClient';

/* ══════════════════════════════════════════
   공개 API — 빌링키 발급
   ══════════════════════════════════════════ */

export type IssueBillingAuthorizationInput = {
  /** 자동결제 등록창 successUrl 콜백의 일회성 인증 키. 최대 300자. */
  authKey: string;
  /** 우리 측 구매자 ID (profiles.customer_key UUID). 2-300자, [a-zA-Z0-9-_=.@]. */
  customerKey: string;
};

/**
 * Toss Billing 객체 — 본 프로젝트에서 사용하는 필드만 발췌.
 * 전체 원본은 호출자가 raw_response 로 보관 가능.
 */
export type TossBillingAuthorizationResponse = {
  /** 상점 ID (≤14자). */
  mId: string;
  /** 입력한 customerKey 그대로 echo. */
  customerKey: string;
  /** 결제수단 인증 시점 (ISO 8601). */
  authenticatedAt: string;
  /** 결제수단 한글 표기 ("카드" / "계좌이체" 등). */
  method: string;
  /** 빌링키 (≤200자). 평생 토큰 — 즉시 안전 저장. */
  billingKey: string;
  /** 카드 결제수단 (계좌이체 시 undefined). */
  card?: {
    issuerCode: string;
    acquirerCode: string;
    /** 마스킹된 카드번호 (≤20자). */
    number: string;
    /** "신용" / "체크" / "기프트" */
    cardType: string;
    /** "개인" / "법인" */
    ownerType: string;
  };
  /** 계좌 결제수단 (카드 시 undefined / 빈 배열). 토스 docs 상 array. */
  transfers?: Array<{
    bankName: string;
    /** 마스킹된 계좌번호. */
    bankAccountNumber: string;
  }>;
  /** 기타 필드는 raw_response 로만 저장 (타입 누락 허용). */
  [key: string]: unknown;
};

/**
 * `POST /v1/billing/authorizations/issue` — 빌링키 발급.
 *
 * 흐름:
 * 1) 클라이언트가 토스 결제창에서 카드/계좌 등록 → successUrl 콜백
 * 2) 콜백 query 의 authKey + customerKey → 본 함수 호출
 * 3) Toss 가 billingKey 응답 → 호출자(billingService)가 billing_methods 즉시 INSERT
 *
 * 정상:
 * - 200 OK → TossBillingAuthorizationResponse
 *
 * 실패:
 * - 4xx → TossApiError (INVALID_AUTH_KEY · NOT_MATCHES_CUSTOMER_KEY 등)
 * - 5xx · 네트워크 → 1회 재시도 후 TossNetworkError
 *
 * @throws TossApiError | TossNetworkError
 */
export async function issueBillingAuthorization(
  input: IssueBillingAuthorizationInput,
): Promise<TossBillingAuthorizationResponse> {
  return tossFetch<TossBillingAuthorizationResponse>(
    '/v1/billing/authorizations/issue',
    {
      method: 'POST',
      body: JSON.stringify({
        authKey: input.authKey,
        customerKey: input.customerKey,
      }),
    },
    'api', // 빌링 = API 개별 연동 시크릿 (TOSS_API_SECRET_KEY)
  );
}

/* ══════════════════════════════════════════
   공개 API — 자동결제 승인
   ══════════════════════════════════════════ */

export type ChargeBillingInput = {
  /** 발급받은 빌링키. URL path encode 됨. */
  billingKey: string;
  /** 빌링키와 매칭되는 customerKey. NOT_MATCHES_CUSTOMER_KEY 방지 필수. */
  customerKey: string;
  /** 결제 금액 (정수). */
  amount: number;
  /** 주문번호 (6-64자, [a-zA-Z0-9-_]). 매 호출 unique — 중복 시 토스 거부. */
  orderId: string;
  /** 구매상품명 (≤100자). */
  orderName: string;
  /** 구매자 이메일 (선택, ≤100자). */
  customerEmail?: string;
  /** 구매자명 (선택, ≤100자). */
  customerName?: string;
  /** 구매자 IP (선택, FDS 활용). */
  customerIp?: string;
  /** 면세 금액 (선택, 기본 0). */
  taxFreeAmount?: number;
  /** 과세 제외 금액 (선택). */
  taxExemptionAmount?: number;
};

/**
 * Toss Payment 객체 — confirmPayment 응답과 동일 구조 + 빌링 특화 필드.
 * tossClient.ts 의 TossConfirmResponse 와 시그니처 호환을 위해 동일 패턴 답습.
 */
export type TossBillingPaymentResponse = {
  paymentKey: string;
  orderId: string;
  /** READY · IN_PROGRESS · DONE · CANCELED · PARTIAL_CANCELED · ABORTED · EXPIRED */
  status: string;
  totalAmount: number;
  /** 취소 가능 잔액. */
  balanceAmount: number;
  /** 결제 승인 시점 (ISO 8601, nullable). */
  approvedAt: string | null;
  card?: {
    amount: number;
    issuerCode: string;
    /** 마스킹된 카드번호 (≤20자). */
    number: string;
    installmentPlanMonths: number;
    approveNo: string;
    cardType: string;
    ownerType: string;
    isInterestFree: boolean;
    interestPayer: string | null;
  };
  /** 계좌 결제수단 (카드 시 null). */
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  } | null;
  /** 영수증 URL. */
  receipts?: { url: string } | null;
  /** 기타 필드는 raw_response 로만 저장. */
  [key: string]: unknown;
};

/**
 * `POST /v1/billing/{billingKey}` — 자동결제 승인.
 *
 * 호출 시점:
 * - 첫 회차: 빌링키 발급 직후 즉시 호출 (사용자 결제 클릭 흐름)
 * - 자동 cycle: pg_cron 이 next_delivery_at 도래 구독 일괄 처리
 *
 * 멱등성:
 * - Idempotency-Key 헤더는 토스 docs 미명시 — orderId unique 보장으로 중복 차단.
 * - 같은 orderId 재호출 시 토스가 ALREADY_PROCESSED_PAYMENT 등으로 거부.
 *
 * 정상:
 * - 200 OK + status='DONE' → 결제 성공
 * - 200 OK + status≠'DONE' → 결제 미완료 (호출자가 분기 처리)
 *
 * 실패:
 * - 4xx → TossApiError (REJECT_CARD_COMPANY · INVALID_CARD · NOT_MATCHES_CUSTOMER_KEY ·
 *         EXCEED_MAX_DAILY_PAYMENT_COUNT · ALREADY_PROCESSED_PAYMENT 등)
 * - 5xx · 네트워크 → 1회 재시도 후 TossNetworkError
 *
 * @throws TossApiError | TossNetworkError
 */
export async function chargeBilling(
  input: ChargeBillingInput,
): Promise<TossBillingPaymentResponse> {
  // billingKey 는 path parameter — encodeURIComponent 로 안전 처리.
  const encoded = encodeURIComponent(input.billingKey);
  return tossFetch<TossBillingPaymentResponse>(`/v1/billing/${encoded}`, {
    method: 'POST',
    body: JSON.stringify({
      customerKey: input.customerKey,
      amount: input.amount,
      orderId: input.orderId,
      orderName: input.orderName,
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      ...(input.customerIp ? { customerIp: input.customerIp } : {}),
      ...(input.taxFreeAmount !== undefined ? { taxFreeAmount: input.taxFreeAmount } : {}),
      ...(input.taxExemptionAmount !== undefined
        ? { taxExemptionAmount: input.taxExemptionAmount }
        : {}),
    }),
  }, 'api'); // 빌링 = API 개별 연동 시크릿 (TOSS_API_SECRET_KEY)
}

