/* ══════════════════════════════════════════════════════════════════════════
   tossClient.ts — TossPayments 서버 API 클라이언트 (P2-B Session 4 B-3)

   역할:
   - `POST /v1/payments/confirm` 호출 (confirm API — B-3)
   - `GET  /v1/payments/{paymentKey}` 호출 (웹훅 GET 재조회 — B-4 공용)
   - Basic Auth 헤더 합성 (`base64("{TOSS_SECRET_KEY}:")`)
   - 네트워크/5xx 1회 재시도 후 `TossNetworkError`
   - Toss 가 반환한 4xx payment-level 에러는 `TossApiError` 로 구조화

   서버 전용:
   - 이 모듈은 Route Handler / Server Action 에서만 사용한다.
     클라이언트 번들에 유입되면 TOSS_SECRET_KEY 가 노출됨.

   로깅 원칙:
   - Basic Auth 헤더와 secretKey 원문은 절대 로깅하지 않는다 (§6.1).
   - 응답 raw 는 Sentry `metadata.tosspayments` 태그로만 전달.

   참조:
   - docs/payments-flow.md §3.1.1 Toss 호출 상세
   - docs/adr/ADR-002-payment-webhook-verification.md §3
   ══════════════════════════════════════════════════════════════════════════ */

/* 런타임 가드 — 클라이언트 번들에서 실행되면 즉시 에러 */
if (typeof window !== 'undefined') {
  throw new Error('tossClient 은 서버 전용 모듈입니다.');
}

/* ══════════════════════════════════════════
   상수
   ══════════════════════════════════════════ */

const TOSS_API_BASE = 'https://api.tosspayments.com';
const TOSS_TIMEOUT_MS = 10_000;

/* ══════════════════════════════════════════
   에러 타입
   ══════════════════════════════════════════ */

/**
 * Toss 서버가 4xx/5xx 로 구조화된 실패를 반환했을 때.
 * body = `{ code, message }` 형태를 Toss 공식 문서가 보장.
 */
export class TossApiError extends Error {
  readonly kind = 'api' as const;
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(`Toss API ${status} ${code}: ${message}`);
    this.name = 'TossApiError';
    this.status = status;
    this.code = code;
  }
}

/** 네트워크 실패 · timeout · 5xx 재시도 후에도 실패한 경우. */
export class TossNetworkError extends Error {
  readonly kind = 'network' as const;
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TossNetworkError';
    this.cause = cause;
  }
}

/* ══════════════════════════════════════════
   내부 유틸
   ══════════════════════════════════════════ */

function getSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) {
    throw new Error('TOSS_SECRET_KEY 미설정 — 서버 환경변수 확인 필요');
  }
  return key;
}

function buildBasicAuthHeader(secretKey: string): string {
  /* Toss 규칙: "{SECRET_KEY}:" 형식을 base64 인코딩 (콜론 뒤 공백 없음).
     Buffer.from 은 서버 전용이므로 module-top gated 상태에서 안전. */
  const token = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${token}`;
}

/** Toss 응답 body 의 code/message 구조. */
type TossErrorBody = { code?: string; message?: string };

function isRetriableStatus(status: number): boolean {
  /* payments-flow §3.1.1: 네트워크·5xx → 1회 재시도 */
  return status >= 500 && status <= 599;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Toss API 공용 fetch wrapper.
 * - AbortController 로 10초 타임아웃.
 * - 5xx · 네트워크 에러 → 1회 재시도.
 * - 4xx → 즉시 TossApiError (재시도 금지 — 카드사 거부·금액 불일치 등).
 */
async function tossFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const url = `${TOSS_API_BASE}${path}`;
  const authHeader = buildBasicAuthHeader(getSecretKey());

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOSS_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const body = (await readJsonSafe(res)) as TossErrorBody | null;

    if (res.ok) {
      return body as T;
    }

    const code = body?.code ?? `HTTP_${res.status}`;
    const message = body?.message ?? res.statusText ?? 'unknown';
    throw new TossApiError(res.status, code, message);
  };

  try {
    return await attempt();
  } catch (err) {
    /* 1회 재시도 판정 (payments-flow §3.1.1):
       - AbortError (timeout) → 재시도
       - TypeError/fetch 실패 → 재시도
       - TossApiError && 5xx → 재시도
       - TossApiError && 4xx → 즉시 throw (재시도 무의미) */
    const retriable =
      (err instanceof TossApiError && isRetriableStatus(err.status)) ||
      err instanceof DOMException || // AbortError
      (err instanceof Error && err.name === 'AbortError') ||
      err instanceof TypeError; // fetch network failure

    if (!retriable) throw err;

    try {
      return await attempt();
    } catch (err2) {
      if (err2 instanceof TossApiError) throw err2;
      throw new TossNetworkError('Toss API network failure after retry', err2);
    }
  }
}

/* ══════════════════════════════════════════
   공개 API — confirm
   ══════════════════════════════════════════ */

export type ConfirmPaymentInput = {
  paymentKey: string;
  orderId: string; // GT-YYYYMMDD-NNNNN
  amount: number;
};

/**
 * Toss confirm 응답 — 스펙 중 본 프로젝트에서 사용하는 필드만 발췌.
 * 전체 원본은 `raw_response` jsonb 로 저장.
 */
export type TossConfirmResponse = {
  paymentKey: string;
  orderId: string;
  orderName?: string;
  status: string; // 'DONE' 등 — 상위 레이어에서 검증
  method?: string; // '카드' / '가상계좌' / '계좌이체' 등 (한글 반환)
  totalAmount: number;
  approvedAt?: string; // ISO 8601
  lastTransactionKey?: string;
  virtualAccount?: {
    accountNumber: string;
    bankCode?: string;
    bank?: string;
    customerName?: string;
    dueDate?: string;
    secret?: string; // 가상계좌 웹훅 검증용 — confirm 시점에 Toss 가 함께 반환
    accountType?: string;
  };
  card?: {
    company?: string;
    number?: string;
    installmentPlanMonths?: number;
  };
  /** 기타 필드는 `raw_response` 로만 저장 (타입 누락 허용). */
  [key: string]: unknown;
};

/**
 * `POST /v1/payments/confirm` — 결제 승인.
 *
 * 정상 플로우:
 * - 200 OK → TossConfirmResponse
 *
 * 실패 플로우:
 * - 400/402/404 → TossApiError (body.code 매핑)
 * - 5xx · 네트워크 → 1회 재시도 후 TossNetworkError
 *
 * @throws TossApiError | TossNetworkError
 */
export async function confirmPayment(
  input: ConfirmPaymentInput,
): Promise<TossConfirmResponse> {
  return tossFetch<TossConfirmResponse>('/v1/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    }),
  });
}

/* ══════════════════════════════════════════
   공개 API — getPayment
   ══════════════════════════════════════════ */

export type TossPaymentCancel = {
  transactionKey: string;
  cancelAmount: number;
  cancelReason?: string;
  taxFreeAmount?: number;
  taxExemptionAmount?: number;
  refundableAmount?: number;
  easyPayDiscountAmount?: number;
  canceledAt?: string;
  transactionKeys?: string[];
};

export type TossGetPaymentResponse = TossConfirmResponse & {
  balanceAmount?: number;
  cancels?: TossPaymentCancel[] | null;
};

/**
 * `GET /v1/payments/{paymentKey}` — 결제 상태 조회.
 *
 * ADR-002 §3 에 따라 카드 웹훅(PAYMENT_STATUS_CHANGED) 검증에서
 * payload 를 신뢰하지 않고 이 엔드포인트로 권위 있는 상태를 재조회한다.
 *
 * @throws TossApiError | TossNetworkError
 */
export async function getPayment(
  paymentKey: string,
): Promise<TossGetPaymentResponse> {
  const encoded = encodeURIComponent(paymentKey);
  return tossFetch<TossGetPaymentResponse>(`/v1/payments/${encoded}`, {
    method: 'GET',
  });
}
