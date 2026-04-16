/* ══════════════════════════════════════════════════════════════════════════
   errors.ts — Route Handler 표준 에러 응답 빌더

   모든 API 에러는 이 모듈의 헬퍼를 통해 반환하여 응답 형태를 통일한다.
   클라이언트 응답에 서버 내부 정보(스택 트레이스·DB 메시지 등)가 노출되지 않도록
   에러 코드(문자열 리터럴)만 공개하고 상세는 서버 로그에만 남긴다.

   포맷 (docs/backend-architecture-plan.md §7.4):
     성공: { data: ... }
     실패: { error: "code" [, fields?: {...}] [, retryAfter?: N] [, detail?: "..." ] }

   참조: §7.3 표준 검증 패턴, §7.4 에러 응답 포맷
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 표준 에러 코드 — Route Handler 전역에서 재사용.
 * 새 코드 추가 시 반드시 아래 union type 에도 반영할 것.
 */
export type ApiErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'payment_failed'
  | 'conflict'
  | 'server_error';

/** 에러 코드 → HTTP 상태 코드 기본 매핑 */
const STATUS_MAP: Record<ApiErrorCode, number> = {
  validation_failed: 400,
  unauthorized: 401,
  payment_failed: 402,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  server_error: 500,
};

/* ── 에러 응답 페이로드 타입 ─────────────────────────────────────────── */

/** zod flatten() 의 fieldErrors 는 string[] | undefined 를 반환하므로 양쪽 모두 허용 */
type FieldErrors = Record<string, string[] | undefined>;

type ValidationErrorBody = {
  error: 'validation_failed';
  fields: FieldErrors;
};

type RateLimitedErrorBody = {
  error: 'rate_limited';
  retryAfter: number;
};

type DetailErrorBody = {
  error: ApiErrorCode;
  detail?: string;
};

type ApiErrorBody = ValidationErrorBody | RateLimitedErrorBody | DetailErrorBody;

/* ── 성공 응답 ───────────────────────────────────────────────────────── */

/**
 * 표준 성공 응답: `{ data: T }`
 *
 * @example
 *   return apiSuccess({ order });          // 200
 *   return apiSuccess({ id }, 201);        // 201 Created
 */
export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

/* ── 에러 응답 빌더 ─────────────────────────────────────────────────── */

/**
 * zod 검증 실패 전용.
 * `parsed.error.flatten().fieldErrors` 를 그대로 전달.
 *
 * @example
 *   const parsed = Schema.safeParse(body);
 *   if (!parsed.success) return apiValidationError(parsed.error.flatten().fieldErrors);
 */
export function apiValidationError(
  fields: FieldErrors,
): Response {
  const body: ValidationErrorBody = { error: 'validation_failed', fields };
  return Response.json(body, { status: 400 });
}

/**
 * Rate limit 초과.
 * @param retryAfter 재시도 가능 시각까지 남은 초
 */
export function apiRateLimited(retryAfter: number): Response {
  const body: RateLimitedErrorBody = { error: 'rate_limited', retryAfter };
  return Response.json(body, {
    status: 429,
    headers: { 'Retry-After': String(Math.ceil(retryAfter)) },
  });
}

/**
 * 범용 에러 응답.
 * - `detail` 은 payment_failed 등 클라이언트에 전달해야 하는 사유만 포함.
 * - 서버 내부 스택·쿼리 오류는 절대 포함하지 않는다.
 *
 * @example
 *   return apiError('unauthorized');
 *   return apiError('not_found');
 *   return apiError('payment_failed', { detail: 'card_declined' });
 *   return apiError('server_error');
 */
export function apiError(
  code: ApiErrorCode,
  opts?: { detail?: string; status?: number },
): Response {
  const status = opts?.status ?? STATUS_MAP[code];
  const body: DetailErrorBody = { error: code };
  if (opts?.detail) body.detail = opts.detail;
  return Response.json(body, { status });
}
