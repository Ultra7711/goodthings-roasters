import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   errors.ts — admin server fetcher 공통 error 요약 (S227 DEC-15)

   답습 source:
   - ordersServer.ts:37-57 (code/message/details/hint 4 필드)
   - subscriptionsServer.ts:38-47 (code/message 2 필드)
   - usersServer.ts:38-47 (code/message 2 필드)

   3 곳 답습 → 단일 SoT. details/hint 는 Orders 만 사용하지만 super-type 으로
   통합 — subs/users 는 그대로 받고 무시 가능.

   참조 ADR: ADR-009 (admin architecture · DEC-15)
   ══════════════════════════════════════════════════════════════════════════ */

export type PgErrorSummary = {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
};

/**
 * Postgrest/일반 Error 모두 동일 형태로 요약.
 * 민감정보 누출 회피 — 각 필드 200자 cap.
 */
export function summarizePgError(err: unknown): PgErrorSummary {
  const e = (err ?? {}) as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const trim = (v: unknown): string | null =>
    typeof v === 'string' ? v.slice(0, 200) : null;
  return {
    code: typeof e.code === 'string' ? e.code : null,
    message: trim(e.message),
    details: trim(e.details),
    hint: trim(e.hint),
  };
}
