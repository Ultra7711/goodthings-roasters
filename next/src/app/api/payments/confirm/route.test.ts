/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — POST /api/payments/confirm 단위 테스트 (Session 8 Opt 2 — A)

   커버리지 (B-3 엔드포인트 = 결제 승인 최종 확정):
   - CSRF 가드              → enforceSameOrigin 403 통과 (early return)
   - Rate Limit             → checkRateLimit 429 통과 (early return)
   - 입력 검증              → parseBody zod 실패 / invalid_json
   - getClaims              → user 인증 / null(게스트) 분기
   - Carding RL (Session 8 #1) → checkCardingLimit 429 early return
   - confirmOrder 성공      → 200 + sendOrderConfirmationEmail fire-and-forget 호출
   - PaymentServiceError 7종 → HTTP 매핑 (404/403/409×3/402/502)
   - toss_failed            → recordCardingAttempt 호출 (err.detail 전달)
   - 예상외 에러            → logPaymentEvent('error', 'confirm_unexpected_error') + 500

   Mock 전략:
   - vi.mock 으로 외부 의존성 전체 차단. enforceSameOrigin / checkRateLimit /
     checkCardingLimit 기본값은 null(=통과). parseBody 는 성공 기본값으로 입력 echo.
   - getClaims 는 beforeEach 에서 user 세팅 → 게스트 케이스만 mockResolvedValueOnce(null).
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock('@/lib/api/csrf', () => ({
  enforceSameOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => null),
  checkCardingLimit: vi.fn(async () => null),
  recordCardingAttempt: vi.fn(async () => undefined),
}));

vi.mock('@/lib/api/validate', () => ({
  parseBody: vi.fn(),
}));

vi.mock('@/lib/auth/getClaims', () => ({
  getClaims: vi.fn(),
}));

vi.mock('@/lib/services/paymentService', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/services/paymentService')
  >('@/lib/services/paymentService');
  return {
    /* PaymentServiceError 클래스는 실제 구현을 유지 — instanceof 분기 정상 동작 */
    PaymentServiceError: actual.PaymentServiceError,
    confirmOrder: vi.fn(),
  };
});

vi.mock('@/lib/email/notifications', () => ({
  sendOrderConfirmationEmail: vi.fn(async () => undefined),
}));

vi.mock('@/lib/logging/paymentLogger', () => ({
  logPaymentEvent: vi.fn(),
  safeErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'unknown',
  ),
}));

/* ── SUT + mocked imports ────────────────────────────────────────────── */

import { POST } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  checkRateLimit,
  checkCardingLimit,
  recordCardingAttempt,
} from '@/lib/auth/rateLimit';
import { parseBody } from '@/lib/api/validate';
import { getClaims } from '@/lib/auth/getClaims';
import {
  confirmOrder,
  PaymentServiceError,
} from '@/lib/services/paymentService';
import { sendOrderConfirmationEmail } from '@/lib/email/notifications';
import { logPaymentEvent } from '@/lib/logging/paymentLogger';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const checkCardingLimitMock = vi.mocked(checkCardingLimit);
const recordCardingAttemptMock = vi.mocked(recordCardingAttempt);
const parseBodyMock = vi.mocked(parseBody);
const getClaimsMock = vi.mocked(getClaims);
const confirmOrderMock = vi.mocked(confirmOrder);
const sendOrderConfirmationEmailMock = vi.mocked(sendOrderConfirmationEmail);
const logPaymentEventMock = vi.mocked(logPaymentEvent);

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const VALID_INPUT = {
  paymentKey: 'tviva20260417abcdef1234567890',
  orderId: 'GT-20260417-00001',
  amount: 12800,
} as const;

const SUCCESS_RESULT = {
  orderNumber: 'GT-20260417-00001',
  publicToken: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  status: 'paid' as const,
  totalAmount: 12800,
  method: 'card' as const,
  virtualAccount: null,
};

function makeRequest(): Request {
  return new Request('https://goodthings-roasters.com/api/payments/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://goodthings-roasters.com',
    },
    body: JSON.stringify(VALID_INPUT),
  });
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('POST /api/payments/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    /* 기본 통과값 재설정 */
    enforceSameOriginMock.mockReturnValue(null);
    checkRateLimitMock.mockResolvedValue(null);
    checkCardingLimitMock.mockResolvedValue(null);
    parseBodyMock.mockResolvedValue({
      success: true,
      data: { ...VALID_INPUT },
    } as Awaited<ReturnType<typeof parseBody>>);
    getClaimsMock.mockResolvedValue({
      userId: 'user-uuid-123',
      email: 'alice@example.com',
    } as Awaited<ReturnType<typeof getClaims>>);
    confirmOrderMock.mockResolvedValue(SUCCESS_RESULT);
  });

  /* ── Guards (early return) ────────────────────────────────────────── */

  it('[1] CSRF 차단 시 enforceSameOrigin 응답을 그대로 반환', async () => {
    const forbiddenRes = new Response(
      JSON.stringify({ error: 'forbidden' }),
      { status: 403 },
    );
    enforceSameOriginMock.mockReturnValueOnce(forbiddenRes);

    const res = await POST(makeRequest());

    expect(res.status).toBe(403);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(parseBodyMock).not.toHaveBeenCalled();
    expect(confirmOrderMock).not.toHaveBeenCalled();
  });

  it('[2] Rate Limit 초과 시 checkRateLimit 응답을 그대로 반환', async () => {
    const limitedRes = new NextResponse(
      JSON.stringify({ error: 'rate_limited', retryAfter: 30 }),
      { status: 429 },
    );
    checkRateLimitMock.mockResolvedValueOnce(limitedRes);

    const res = await POST(makeRequest());

    expect(res.status).toBe(429);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      'payment_confirm',
    );
    expect(parseBodyMock).not.toHaveBeenCalled();
    expect(confirmOrderMock).not.toHaveBeenCalled();
  });

  it('[3] zod 실패 시 parseBody 의 response 를 그대로 반환', async () => {
    const zodFailRes = new Response(
      JSON.stringify({ error: 'validation_failed', fields: { amount: ['min'] } }),
      { status: 400 },
    );
    parseBodyMock.mockResolvedValueOnce({
      success: false,
      response: zodFailRes,
    } as Awaited<ReturnType<typeof parseBody>>);

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(confirmOrderMock).not.toHaveBeenCalled();
  });

  /* ── 인증 분기 ──────────────────────────────────────────────────────── */

  it('[4] 로그인 유저: confirmOrder 에 userId 전달', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(confirmOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: VALID_INPUT.orderId }),
      { userId: 'user-uuid-123' },
    );
  });

  it('[5] 게스트(claims 없음): confirmOrder 에 userId=null 전달', async () => {
    getClaimsMock.mockResolvedValueOnce(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(confirmOrderMock).toHaveBeenCalledWith(
      expect.anything(),
      { userId: null },
    );
  });

  /* ── Carding RL (Session 8 #1) ─────────────────────────────────────── */

  it('[6] Carding 한도 초과 시 checkCardingLimit 응답 그대로 (429)', async () => {
    const cardingRes = new NextResponse(
      JSON.stringify({ error: 'too_many_card_attempts', retryAfter: 600 }),
      { status: 429 },
    );
    checkCardingLimitMock.mockResolvedValueOnce(cardingRes);

    const res = await POST(makeRequest());

    expect(res.status).toBe(429);
    expect(checkCardingLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      'user-uuid-123',
    );
    expect(confirmOrderMock).not.toHaveBeenCalled();
  });

  it('[7] 게스트의 Carding 선검사: userId=null 키로 호출', async () => {
    getClaimsMock.mockResolvedValueOnce(null);

    await POST(makeRequest());

    expect(checkCardingLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      null,
    );
  });

  /* ── 성공 경로 ─────────────────────────────────────────────────────── */

  it('[8] 200 — 정상 승인 + 주문 확인 메일 fire-and-forget 호출', async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof SUCCESS_RESULT };
    expect(body.data.orderNumber).toBe(SUCCESS_RESULT.orderNumber);
    expect(body.data.status).toBe('paid');

    /* 이메일은 await 되지 않음 (fire-and-forget) 이나 동기 호출 자체는 즉시
       Session 11 #3-4a: publicToken 세번째 인자로 전달. */
    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledWith(
      SUCCESS_RESULT.orderNumber,
      null,
      { publicToken: SUCCESS_RESULT.publicToken },
    );
  });

  it('[9] 200 — 가상계좌 결제 시 virtualAccount 페이로드 포함 전달', async () => {
    const vaResult = {
      ...SUCCESS_RESULT,
      method: 'transfer' as const,
      virtualAccount: {
        bank: '국민',
        accountNumber: '0000000000',
        dueDate: '2026-04-20T23:59:59+09:00',
        customerName: '홍길동',
      },
    };
    confirmOrderMock.mockResolvedValueOnce(vaResult);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledWith(
      vaResult.orderNumber,
      vaResult.virtualAccount,
      { publicToken: vaResult.publicToken },
    );
  });

  /* ── PaymentServiceError 매핑 ──────────────────────────────────────── */

  it('[10] not_found → 404', async () => {
    confirmOrderMock.mockRejectedValueOnce(new PaymentServiceError('not_found'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not_found');
  });

  it('[11] forbidden → 403 + detail 전달', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('forbidden', 'guest_email_mismatch'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('forbidden');
    expect(body.detail).toBe('guest_email_mismatch');
  });

  it('[12] state_conflict → 409 + detail="state_conflict:<prev>"', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('state_conflict', 'canceled'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('conflict');
    expect(body.detail).toBe('state_conflict:canceled');
  });

  it('[13] amount_mismatch → 409 + detail="amount_mismatch"', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('amount_mismatch'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('amount_mismatch');
  });

  it('[14] method_mismatch → 409 + detail="method_mismatch:<...>"', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('method_mismatch', 'card_vs_virtual_account'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('method_mismatch:card_vs_virtual_account');
  });

  it('[15] toss_failed → 402 + recordCardingAttempt 호출(err.detail 전달)', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('toss_failed', 'REJECT_CARD_COMPANY'),
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('payment_failed');
    expect(body.detail).toBe('REJECT_CARD_COMPANY');

    /* Session 8 #1: 거절 코드 시그널 증분 (fire-and-forget) */
    expect(recordCardingAttemptMock).toHaveBeenCalledWith(
      expect.any(Request),
      'user-uuid-123',
      'REJECT_CARD_COMPANY',
    );
  });

  it('[16] toss_failed detail 없음 → 402 + detail="unknown" (recordCardingAttempt 여전히 호출)', async () => {
    confirmOrderMock.mockRejectedValueOnce(new PaymentServiceError('toss_failed'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('unknown');
    /* detail undefined 도 recordCardingAttempt 에 전달 (isCardRejectionCode 가 걸러냄) */
    expect(recordCardingAttemptMock).toHaveBeenCalledWith(
      expect.any(Request),
      'user-uuid-123',
      undefined,
    );
  });

  it('[17] toss_unavailable → 502 + detail="toss_unavailable"', async () => {
    confirmOrderMock.mockRejectedValueOnce(
      new PaymentServiceError('toss_unavailable'),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('server_error');
    expect(body.detail).toBe('toss_unavailable');
  });

  /* ── 예상외 에러 ───────────────────────────────────────────────────── */

  it('[18] 일반 Error 는 logPaymentEvent 로 기록 후 500 server_error', async () => {
    confirmOrderMock.mockRejectedValueOnce(new Error('pgrst_boom'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('server_error');

    expect(logPaymentEventMock).toHaveBeenCalledWith(
      'error',
      'confirm_unexpected_error',
      expect.objectContaining({ errorMessage: 'pgrst_boom' }),
    );
    /* 성공 메일은 절대 발송되지 않아야 함 */
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });
});
