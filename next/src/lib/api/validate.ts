/* ══════════════════════════════════════════════════════════════════════════
   validate.ts — Route Handler 표준 zod 검증 헬퍼

   모든 Route Handler 는 req.json() 을 직접 파싱하지 않고 이 모듈의 헬퍼를
   사용하여 입력 검증 + 에러 포맷을 단일 패턴으로 통일한다.

   사용법:
     const result = await parseBody(request, OrderCreateSchema);
     if (!result.success) return result.response;   // 400 자동 반환
     const { items, shipping } = result.data;       // 타입 안전

   참조: docs/backend-architecture-plan.md §7.3
   ══════════════════════════════════════════════════════════════════════════ */

import type { ZodType } from 'zod';
import { apiValidationError, apiError } from './errors';

/* ── 결과 타입 ───────────────────────────────────────────────────────── */

type ParseSuccess<T> = {
  success: true;
  data: T;
};

type ParseFailure = {
  success: false;
  response: Response;
};

type ParseResult<T> = ParseSuccess<T> | ParseFailure;

/* ── JSON Body 파싱 + 검증 ───────────────────────────────────────────── */

/**
 * 요청 body 를 JSON 파싱 → zod 스키마 검증.
 *
 * - JSON 파싱 실패: 400 `validation_failed` (fields: {})
 * - 스키마 불일치:  400 `validation_failed` + flatten().fieldErrors
 *
 * @example
 *   const result = await parseBody(request, MySchema);
 *   if (!result.success) return result.response;
 *   // result.data 는 MySchema 의 추론 타입
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: apiError('validation_failed', {
        detail: 'invalid_json',
        status: 400,
      }),
    };
  }

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      response: apiValidationError(parsed.error.flatten().fieldErrors),
    };
  }

  return { success: true, data: parsed.data };
}

/* ── URL SearchParams 파싱 + 검증 ────────────────────────────────────── */

/**
 * URL search params 를 plain object 로 변환 후 zod 검증.
 * GET 엔드포인트의 쿼리 파라미터 검증에 사용.
 *
 * @example
 *   const result = parseSearchParams(request, PaginationSchema);
 *   if (!result.success) return result.response;
 *   const { page, limit } = result.data;
 */
export function parseSearchParams<T>(
  request: Request,
  schema: ZodType<T>,
): ParseResult<T> {
  const { searchParams } = new URL(request.url);
  // URLSearchParams → Record<string, string> (단일 값 기준)
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      response: apiValidationError(parsed.error.flatten().fieldErrors),
    };
  }

  return { success: true, data: parsed.data };
}
