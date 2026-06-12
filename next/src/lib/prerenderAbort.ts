import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/prerenderAbort.ts — PPR prerender abort 식별 (S318)

   Next.js 16 cacheComponents(PPR) 는 빌드/갱신 시 static shell 을 prerender
   하려다 caller 의 connection() 에서 dynamic 전환하며 in-flight fetch 를 abort
   한다. Supabase JS 가 이 abort reject 를 error 로 변환(code:'' · message 에
   "During prerendering, fetch() rejects ..." 포함)하지만 실제 쿼리 실패가 아니다 —
   dynamic 렌더에서 정상 재실행되므로 B2C SSR fetch 의 graceful fallback 은 동작에
   영향이 없고, console.error 로그 노이즈만 빌드 로그를 오염시킨다.

   Next 의 unstable_rethrow 는 인스턴스/심볼 기반이라 Supabase 가 변환한 일반 객체엔
   안 먹는다. 변환된 error.message 문자열로 식별하여 로깅만 건너뛴다(반환값 무변경). */
export function isPrerenderAbort(message: string | null | undefined): boolean {
  return message?.includes('prerender') ?? false;
}
