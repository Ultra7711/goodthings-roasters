/* ══════════════════════════════════════════════════════════════════════════
   POST /api/payments/webhook — Toss 결제 웹훅 수신 (P2-B Session 5 B-4)

   요청 흐름:
   1) CSRF 화이트리스트 통과 (lib/api/csrf.ts)
      - Origin 검증 불가한 외부 발신자이므로 enforceSameOrigin 예외 경로.
   2) Rate Limit 미적용 (Toss 재시도에 방해되므로 §6.2).
   3) raw body → JSON 파싱 → KnownWebhookSchema discriminated union.
      실패 시 UnknownWebhookSchema 로 폴백 → 감사 로그만 남기고 200.
   4) eventType 분기:
      - PAYMENT_STATUS_CHANGED → webhookService.handleCardWebhook
      - DEPOSIT_CALLBACK       → webhookService.handleVirtualAccountWebhook
   5) WebhookResult → HTTP 응답 매핑:
      - ok              → 200 `{ received: true }`
      - timing_inversion → 503 + Retry-After: 30 + x-webhook-timing-inversion: true
      - auth_failed     → 401
      - bad_request     → 400

   주의:
   - Toss 는 2xx 이외의 응답이면 exponential backoff 로 최대 7회 재시도한다.
     타이밍 역전 503 은 의도된 정상 동작 — Sentry 샘플링 제외 대상(§5.3.1).
   - 클라이언트에게 Toss 응답 원문이나 DB 에러를 유출하지 않는다.

   참조:
   - docs/payments-flow.md §3.2 · §5.3.1 · §6.1 · §6.2
   - docs/adr/ADR-002-payment-webhook-verification.md
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import {
  KnownWebhookSchema,
  UnknownWebhookSchema,
} from '@/lib/schemas/webhook';
import {
  handleCardWebhook,
  handleUnknownWebhook,
  handleVirtualAccountWebhook,
  type WebhookResult,
} from '@/lib/services/webhookService';

/* ══════════════════════════════════════════
   응답 빌더
   ══════════════════════════════════════════ */

function okResponse(): Response {
  return Response.json({ received: true }, { status: 200 });
}

/**
 * §5.3.1 — 타이밍 역전 503 전용.
 * `Retry-After: 30` + `x-webhook-timing-inversion: true` (Sentry 샘플링 제외용).
 */
function timingInversionResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'timing_inversion_retry' }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '30',
        'x-webhook-timing-inversion': 'true',
      },
    },
  );
}

function resultToResponse(result: WebhookResult): Response {
  switch (result.kind) {
    case 'ok':
      return okResponse();
    case 'timing_inversion':
      return timingInversionResponse();
    case 'auth_failed':
      return apiError('unauthorized', { detail: result.detail });
    case 'bad_request':
      return apiError('validation_failed', { detail: result.detail });
    default: {
      const _exhaustive: never = result.kind;
      void _exhaustive;
      return apiError('server_error');
    }
  }
}

/* ══════════════════════════════════════════
   POST handler
   ══════════════════════════════════════════ */

export async function POST(request: Request): Promise<Response> {
  /* 1) CSRF 화이트리스트 통과 확인 — 웹훅 경로는 null 반환.
        (enforceSameOrigin 이 CSRF_EXEMPT_PATHS 에 근거해 분기) */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit — 의도적으로 미적용 (§6.2). */

  /* 3) raw body → JSON */
  let raw: string;
  try {
    raw = await request.text();
  } catch (err) {
    console.error('[POST /api/payments/webhook] body read failed', err);
    return apiError('validation_failed', { detail: 'body_read_failed' });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }

  /* 4) discriminatedUnion 파싱 → 실패 시 Unknown 폴백 */
  const known = KnownWebhookSchema.safeParse(json);
  try {
    if (known.success) {
      const payload = known.data;
      /* discriminated union 분기 — 타입 narrowing */
      if (payload.eventType === 'PAYMENT_STATUS_CHANGED') {
        /* 이중 안전망: KnownWebhookSchema 내부의 CardWebhookSchema 가 이미 통과.
           타입 호환을 위해 재검증 없이 그대로 사용. */
        const result = await handleCardWebhook(payload);
        return resultToResponse(result);
      }
      if (payload.eventType === 'DEPOSIT_CALLBACK') {
        const result = await handleVirtualAccountWebhook(payload);
        return resultToResponse(result);
      }
      /* discriminatedUnion 확장 시 이 분기가 닫히도록 보장 */
      const _exhaustive: never = payload;
      void _exhaustive;
    }

    /* 폴백: 전체 스키마는 깼지만 eventType 만 존재하는 페이로드 */
    const unknown = UnknownWebhookSchema.safeParse(json);
    if (unknown.success) {
      const result = await handleUnknownWebhook(unknown.data);
      return resultToResponse(result);
    }

    /* eventType 자체가 문자열이 아님 — 진짜 파싱 실패 */
    return apiError('validation_failed', { detail: 'schema_invalid' });
  } catch (err) {
    /* DB/네트워크 등 예기치 못한 실패 — 500 로 Toss 재시도 유도 */
    console.error('[POST /api/payments/webhook] unexpected error', err);
    return apiError('server_error');
  }
}

