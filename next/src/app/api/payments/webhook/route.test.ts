/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — POST /api/payments/webhook 단위 테스트 (Session 8 Opt 2 — B)

   커버리지 (B-4 엔드포인트 = Toss 웹훅 수신):
   - CSRF 가드               → enforceSameOrigin null (화이트리스트) 가정
   - body 읽기 실패          → 400 body_read_failed + logPaymentEvent
   - invalid JSON            → 400 invalid_json
   - KnownWebhookSchema
     · PAYMENT_STATUS_CHANGED → handleCardWebhook 호출 (200/503/401/400 매핑)
     · DEPOSIT_CALLBACK       → handleVirtualAccountWebhook 호출
   - UnknownWebhookSchema 폴백 → handleUnknownWebhook 호출
   - schema_invalid           → 400 (eventType 조차 없음)
   - timing_inversion 응답    → 503 + Retry-After: 30 + x-webhook-timing-inversion: true
   - auth_failed              → 401
   - bad_request              → 400
   - 서비스 throw             → 500 + logPaymentEvent('error', 'webhook_unexpected_error')
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock('@/lib/api/csrf', () => ({
  enforceSameOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/services/webhookService', () => ({
  handleCardWebhook: vi.fn(),
  handleVirtualAccountWebhook: vi.fn(),
  handleUnknownWebhook: vi.fn(),
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
  handleCardWebhook,
  handleUnknownWebhook,
  handleVirtualAccountWebhook,
  type WebhookResult,
} from '@/lib/services/webhookService';
import { logPaymentEvent } from '@/lib/logging/paymentLogger';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const handleCardWebhookMock = vi.mocked(handleCardWebhook);
const handleVirtualAccountWebhookMock = vi.mocked(handleVirtualAccountWebhook);
const handleUnknownWebhookMock = vi.mocked(handleUnknownWebhook);
const logPaymentEventMock = vi.mocked(logPaymentEvent);

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const WEBHOOK_URL = 'https://goodthings-roasters.com/api/payments/webhook';

const CARD_PAYLOAD = {
  eventType: 'PAYMENT_STATUS_CHANGED',
  createdAt: '2026-04-17T10:00:00+09:00',
  data: {
    paymentKey: 'tviva20260417abcdef1234567890',
    orderId: 'GT-20260417-00001',
    status: 'DONE',
    lastTransactionKey: 'txn-last-key-123',
  },
} as const;

const DEPOSIT_PAYLOAD = {
  eventType: 'DEPOSIT_CALLBACK',
  secret: 'deposit-secret-abc',
  createdAt: '2026-04-17T10:00:00+09:00',
  data: {
    orderId: 'GT-20260417-00002',
    paymentStatus: 'DONE',
  },
} as const;

function makeRequest(body: unknown): Request {
  return new Request(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const OK_RESULT: WebhookResult = { kind: 'ok' };

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceSameOriginMock.mockReturnValue(null);
    handleCardWebhookMock.mockResolvedValue(OK_RESULT);
    handleVirtualAccountWebhookMock.mockResolvedValue(OK_RESULT);
    handleUnknownWebhookMock.mockResolvedValue(OK_RESULT);
  });

  /* ── CSRF 화이트리스트 ─────────────────────────────────────────────── */

  it('[1] CSRF 가드가 차단 응답을 반환하면 그대로 반환 (화이트리스트 미설정 경로 방어)', async () => {
    const forbidden = new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
    });
    enforceSameOriginMock.mockReturnValueOnce(forbidden);

    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(403);
    expect(handleCardWebhookMock).not.toHaveBeenCalled();
    expect(handleVirtualAccountWebhookMock).not.toHaveBeenCalled();
  });

  /* ── body/JSON 파싱 ────────────────────────────────────────────────── */

  it('[2] invalid JSON 바디 → 400 invalid_json', async () => {
    const res = await POST(makeRequest('not-json-{{{'));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('validation_failed');
    expect(body.detail).toBe('invalid_json');
    expect(handleCardWebhookMock).not.toHaveBeenCalled();
  });

  it('[3] body 읽기 실패 → 400 body_read_failed + logPaymentEvent', async () => {
    /* request.text() 가 throw 하도록 조작된 Request stub */
    const req = new Request(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    Object.defineProperty(req, 'text', {
      value: async () => {
        throw new Error('body_stream_broken');
      },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('body_read_failed');
    expect(logPaymentEventMock).toHaveBeenCalledWith(
      'error',
      'webhook_body_read_failed',
      expect.objectContaining({ errorMessage: 'body_stream_broken' }),
    );
  });

  /* ── Known: PAYMENT_STATUS_CHANGED ─────────────────────────────────── */

  it('[4] PAYMENT_STATUS_CHANGED → handleCardWebhook 호출 + 200 {received: true}', async () => {
    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean };
    expect(body.received).toBe(true);

    expect(handleCardWebhookMock).toHaveBeenCalledOnce();
    expect(handleVirtualAccountWebhookMock).not.toHaveBeenCalled();
    expect(handleUnknownWebhookMock).not.toHaveBeenCalled();
  });

  it('[5] timing_inversion 결과 → 503 + Retry-After:30 + x-webhook-timing-inversion:true', async () => {
    handleCardWebhookMock.mockResolvedValueOnce({
      kind: 'timing_inversion',
      detail: 'payments_row_missing',
    });

    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(res.headers.get('x-webhook-timing-inversion')).toBe('true');
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('timing_inversion_retry');
  });

  it('[6] auth_failed 결과 → 401 unauthorized + detail 전달', async () => {
    handleCardWebhookMock.mockResolvedValueOnce({
      kind: 'auth_failed',
      detail: 'amount_mismatch',
    });

    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('unauthorized');
    expect(body.detail).toBe('amount_mismatch');
  });

  it('[7] bad_request 결과 → 400 validation_failed + detail 전달', async () => {
    handleCardWebhookMock.mockResolvedValueOnce({
      kind: 'bad_request',
      detail: 'order_not_found',
    });

    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('validation_failed');
    expect(body.detail).toBe('order_not_found');
  });

  /* ── Known: DEPOSIT_CALLBACK ───────────────────────────────────────── */

  it('[8] DEPOSIT_CALLBACK → handleVirtualAccountWebhook 호출 + 200', async () => {
    const res = await POST(makeRequest(DEPOSIT_PAYLOAD));

    expect(res.status).toBe(200);
    expect(handleVirtualAccountWebhookMock).toHaveBeenCalledOnce();
    expect(handleCardWebhookMock).not.toHaveBeenCalled();
    expect(handleUnknownWebhookMock).not.toHaveBeenCalled();
  });

  it('[9] DEPOSIT_CALLBACK + timing_inversion (webhook_secret 부재) → 503', async () => {
    handleVirtualAccountWebhookMock.mockResolvedValueOnce({
      kind: 'timing_inversion',
      detail: 'webhook_secret_missing',
    });

    const res = await POST(makeRequest(DEPOSIT_PAYLOAD));

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
  });

  /* ── Unknown 폴백 ───────────────────────────────────────────────────── */

  it('[10] 알 수 없는 eventType → UnknownWebhookSchema 폴백 + handleUnknownWebhook + 200', async () => {
    const res = await POST(
      makeRequest({
        eventType: 'FUTURE_EVENT_TYPE',
        createdAt: '2026-04-17T10:00:00+09:00',
        data: { arbitrary: 'payload' },
      }),
    );

    expect(res.status).toBe(200);
    expect(handleUnknownWebhookMock).toHaveBeenCalledOnce();
    expect(handleCardWebhookMock).not.toHaveBeenCalled();
    expect(handleVirtualAccountWebhookMock).not.toHaveBeenCalled();
  });

  it('[11] KnownWebhookSchema 파싱 깨지지만 eventType 존재 → Unknown 폴백', async () => {
    /* PAYMENT_STATUS_CHANGED 지만 data.paymentKey 누락 → Known 실패, Unknown 성공 */
    const broken = {
      eventType: 'PAYMENT_STATUS_CHANGED',
      createdAt: '2026-04-17T10:00:00+09:00',
      data: { orderId: 'GT-20260417-00001' },
    };
    const res = await POST(makeRequest(broken));

    expect(res.status).toBe(200);
    expect(handleUnknownWebhookMock).toHaveBeenCalledOnce();
    expect(handleCardWebhookMock).not.toHaveBeenCalled();
  });

  /* ── schema_invalid (eventType 조차 없음) ──────────────────────────── */

  it('[12] eventType 누락 → 400 schema_invalid', async () => {
    const res = await POST(makeRequest({ foo: 'bar' }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('validation_failed');
    expect(body.detail).toBe('schema_invalid');
    expect(handleUnknownWebhookMock).not.toHaveBeenCalled();
  });

  it('[13] eventType 이 문자열이 아님 → 400 schema_invalid', async () => {
    const res = await POST(makeRequest({ eventType: 123 }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('schema_invalid');
  });

  /* ── 서비스 throw → 500 + 로그 ──────────────────────────────────────── */

  it('[14] handleCardWebhook throw → 500 server_error + logPaymentEvent', async () => {
    handleCardWebhookMock.mockRejectedValueOnce(new Error('db_down'));

    const res = await POST(makeRequest(CARD_PAYLOAD));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('server_error');

    expect(logPaymentEventMock).toHaveBeenCalledWith(
      'error',
      'webhook_unexpected_error',
      expect.objectContaining({ errorMessage: 'db_down' }),
    );
  });

  it('[15] handleUnknownWebhook throw 도 동일하게 500 + 로그', async () => {
    handleUnknownWebhookMock.mockRejectedValueOnce(new Error('log_sink_failed'));

    const res = await POST(
      makeRequest({
        eventType: 'MYSTERY',
        createdAt: '2026-04-17T10:00:00+09:00',
      }),
    );

    expect(res.status).toBe(500);
    expect(logPaymentEventMock).toHaveBeenCalledWith(
      'error',
      'webhook_unexpected_error',
      expect.objectContaining({ errorMessage: 'log_sink_failed' }),
    );
  });
});
