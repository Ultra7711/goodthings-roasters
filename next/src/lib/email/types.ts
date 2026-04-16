/* ══════════════════════════════════════════════════════════════════════════
   email/types.ts — 이메일 공통 레이어 타입 정의

   사양: docs/email-infrastructure.md §4
   ════════════════════════════════════════════════════════════════════════ */

/**
 * sendEmail() 공용 진입 페이로드.
 *
 * SDK 공식 idempotencyKey 필드를 1급 인자로 노출한다 (Context7 재검증 결과).
 * Resend Node SDK v4: client.emails.send(payload, { idempotencyKey })
 * 구현부에서는 payload.idempotencyKey 또는 2nd arg 옵션 중 하나로 전달한다.
 */
export type EmailPayload = {
  /** 생략 시 RESEND_FROM_EMAIL env 사용. live 모드에서는 필수. */
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  /**
   * Resend SDK 공식 idempotency-key (24시간 이내 동일 키 재요청 시 이전 응답 반환).
   * 주문번호 기반 조합 권장: `order-confirm:${orderNumber}` 등.
   */
  idempotencyKey?: string;
  /**
   * Session 11 에서 React Email 컴포넌트 주입 예정.
   * 현재는 옵션만 정의하며 stub/live 양쪽에서 전달만 하고 해석은 SDK 에 위임한다.
   */
  react?: unknown;
};

export type EmailMode = 'live' | 'stub';

export type EmailErrorCode =
  | 'rate_limit_exceeded'
  | 'invalid_payload'
  | 'auth_failed'
  | 'provider_error'
  | 'network_error'
  | 'not_configured'
  | 'unknown';

export type EmailResult =
  | { ok: true; id: string; mode: EmailMode }
  | { ok: false; error: EmailErrorShape; mode: EmailMode };

/**
 * EmailResult 실패 케이스에서 직렬화 가능한 형태로 노출되는 에러 프로필.
 * 실제 throw 는 EmailError 클래스 (errors.ts) 가 담당한다.
 */
export type EmailErrorShape = {
  code: EmailErrorCode;
  message: string;
  retryable: boolean;
};
