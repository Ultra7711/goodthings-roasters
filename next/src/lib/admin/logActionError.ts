/* ══════════════════════════════════════════════════════════════════════════
   logActionError — 어드민 server action 표준 console.error 포맷 (S264-D LOW-A)

   답습 source: productActions / imageActions / menuActions 등 ~12 곳의 동일 패턴.
   - prefix: `[actionName] context` 권장
   - error.message 는 200자 truncate (로그 크기 제어)
   - error.code 는 null 허용 (Storage error / RPC 비표준 등)
   - extra 는 도메인 컨텍스트 (slug / id / count / path 등) 추가 시만 전달

   기존 코드:
     console.error('[xxx] failed', {
       code: error.code,
       message: error.message?.slice(0, 200),
     });
   ⇒ logActionError('[xxx] failed', error);

   확장 컨텍스트:
     console.error('[xxx] storage remove failed', {
       slug: prodSlug,
       count: paths.length,
       message: rmErr.message?.slice(0, 200),
     });
   ⇒ logActionError('[xxx] storage remove failed', rmErr, { slug: prodSlug, count: paths.length });

   비표준 (자유형식) console.error 는 본 헬퍼 미사용 — inline 유지.
   ══════════════════════════════════════════════════════════════════════════ */

type PgErrorLike = {
  code?: string | null;
  message?: string | null;
};

export function logActionError(
  prefix: string,
  error: PgErrorLike | null | undefined,
  extra?: Record<string, unknown>,
): void {
  const base = {
    code: error?.code ?? null,
    message: error?.message ? error.message.slice(0, 200) : null,
  };
  // eslint-disable-next-line no-console
  console.error(prefix, extra ? { ...base, ...extra } : base);
}
