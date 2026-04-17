/* ══════════════════════════════════════════════════════════════════════════
   logging/paymentLogger.ts — PCI-safe 결제 이벤트 로거 (Session 8 보안 #4)

   사양: docs/payments-security-hardening.md §5

   목적:
   - Toss paymentKey / customer PII 필드가 Vercel 로그에 평문 보존되지 않도록
     전면 마스킹 + allowlist 기반 구조화 로깅.
   - PCI DSS v4.0 §3.4 "render unreadable", §10.4.1 "audit log content",
     §10.7 "retention" 기준선 충족.
   - 회귀 방지: ESLint 커스텀 규칙 (`no-restricted-syntax`) + 본 유틸만 허용.

   확정안 (D9~D11):
   - D9: paymentKey 포맷 = `tviva_XXXXXX****XXXX#<sha256 prefix 5>` — 앞/뒤 보존 +
     해시 prefix 로 동일 거래 상관관계 추적. 재식별 불가.
   - D10: error 스택은 `NODE_ENV !== 'production'` 에서만 포함. 프로덕션은 `message`
     만 남겨 Sentry 연동 전까지 민감 정보 유출 차단.
   - D11: 컨텍스트 객체는 **allowlist** — `PaymentLogContext` 에 명시된 키 이외는
     컴파일 에러. Supabase service_role key 등이 우발적으로 실려가지 않도록 차단.

   사용:
   ```ts
   import { logPaymentEvent, maskPaymentKey } from '@/lib/logging/paymentLogger';
   logPaymentEvent('warn', 'approved_at_fallback', {
     orderId: order.id,
     paymentKeyMasked: maskPaymentKey(tossResponse.paymentKey),
     fallbackApprovedAt: approvedAt,
   });
   ```
   ══════════════════════════════════════════════════════════════════════════ */

import { createHash } from 'node:crypto';

/* ─── 마스킹 ─────────────────────────────────────────────────────────────── */

/**
 * Toss paymentKey 마스킹 — 앞 6자 + `****` + 뒤 4자 + 해시 prefix.
 *
 * 출력 예: `tviva_XXXXXX****XXXX#a3f1b`
 *
 * - 원본 paymentKey 는 로그/에러 메시지에 절대 남기지 않는다 (PCI §10.4.1).
 * - 해시 prefix 는 sha256(paymentKey) 의 앞 5 헥스 — 같은 거래의 로그 라인끼리
 *   상관관계 추적은 가능하되, 역추적은 불가 (preimage resistance).
 * - 8자 미만 같은 비정상 값은 `***SHORT#<hash>` 로 대체 — 로그에 truncated 값이
 *   남아도 부분 재식별 위험 최소화.
 */
export function maskPaymentKey(key: string | null | undefined): string {
  if (!key || typeof key !== 'string') return '***EMPTY';
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 5);
  if (key.length < 12) return `***SHORT#${hash}`;
  return `${key.slice(0, 6)}****${key.slice(-4)}#${hash}`;
}

/* ─── allowlist 컨텍스트 타입 (D11) ────────────────────────────────────── */

/**
 * 결제 이벤트 로그에 포함 가능한 필드 (allowlist).
 *
 * 새 필드가 필요하면 이 타입에 추가 후 리뷰 — 이유:
 * - Supabase URL/key, 전체 user 객체, Toss 원본 응답 등이 우발적으로 주입되는
 *   것을 방지.
 * - 새 필드 추가 시에도 PII/민감도 검토 체크리스트를 거친다.
 */
export type PaymentLogContext = {
  /** DB orders.id (uuid) — 고객 식별자 아님, 안전. */
  orderId?: string;
  /** DB orders.order_number — 내부 식별자 (#3 public_token 도입 후에도 내부용 유지). */
  orderNumber?: string;
  /** maskPaymentKey() 를 거친 값만 허용. 타입으로 강제하긴 어렵지만 이름으로 유도. */
  paymentKeyMasked?: string;
  /** Toss 결제 수단 method (card|transfer|easy_pay). */
  method?: string;
  /** 결제 상태 코드 (IN_PROGRESS|DONE|CANCELED|FAILED 등). */
  status?: string;
  /** Toss 에러 코드 (공식 문자열 열거). */
  tossCode?: string;
  /** ISO-8601 타임스탬프 문자열. */
  fallbackApprovedAt?: string;
  /** 금액 (정수 원). */
  amount?: number;
  /** 연관 이벤트 식별자 — idempotencyKey 등 프리픽스 truncated 문자열. */
  eventId?: string;
  /** 일반 에러 메시지 (err.message 만, stack 금지). */
  errorMessage?: string;
  /** Rate limit / carding 관련 카운트. */
  attempt?: number;
  /** 기타 수치 지표 — duration_ms, retry_count 등. 문자열/객체 금지. */
  durationMs?: number;
};

type LogLevel = 'info' | 'warn' | 'error';

/* ─── 로거 진입 ────────────────────────────────────────────────────────── */

/**
 * 구조화 결제 이벤트 로거.
 *
 * 출력 포맷 (단일 라인):
 *   `[payment:{level}] event={event} orderId=... paymentKeyMasked=... ...`
 *
 * - 값은 `JSON.stringify` 로 이스케이프 → 개행·따옴표 인젝션 방지.
 * - undefined 필드는 생략. null 은 `null` 문자열로 명시.
 * - `errorMessage` 는 길이 200자 truncate (stack 오염 방어).
 */
export function logPaymentEvent(
  level: LogLevel,
  event: string,
  ctx: PaymentLogContext,
): void {
  const parts: string[] = [`event=${JSON.stringify(event)}`];
  for (const [key, value] of Object.entries(ctx)) {
    if (value === undefined) continue;
    let safe: string;
    if (typeof value === 'string') {
      const clipped = key === 'errorMessage' && value.length > 200
        ? `${value.slice(0, 200)}…`
        : value;
      safe = JSON.stringify(clipped);
    } else {
      safe = JSON.stringify(value);
    }
    parts.push(`${key}=${safe}`);
  }
  const line = `[payment:${level}] ${parts.join(' ')}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Error 객체에서 로그에 안전한 message 를 추출.
 *
 * - `NODE_ENV !== 'production'` 일 때만 stack 포함 (D10).
 * - 프로덕션은 `err.message` only — stack 은 향후 Sentry 연동으로 별도 전달.
 * - 비-Error 값 (string·number·object) 은 `String(err)` 로 강제 변환.
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || err.name || 'unknown_error';
    if (process.env.NODE_ENV !== 'production' && err.stack) {
      return `${msg}\n${err.stack}`;
    }
    return msg;
  }
  try {
    return String(err);
  } catch {
    return 'unserializable_error';
  }
}
