import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/listHelpers.ts — 어드민 리스트 fetcher 공통 helper (S229 DEC-17 B안)

   audit (`memory/project_admin_architecture_audit.md` §2-2 Candidate A) 의
   풀 factory 안 (4 도메인 × 8슬롯 config) 검토 결과:
   - products = pagination/counts 없음 → factory 적용 무의미
   - 3 도메인 (orders/users/subscriptions) 도 counts 모드 / search 복잡도 차이
     → factory config 가 원본만큼 복잡 (shallow interface 위험)

   결정: 풀 factory 대신 공통 helper 3종만 추출.
   - AdminListResult<T, S, F>  — 결과 shape 통일
   - applyRange                — 1-base page → Supabase range()
   - applyIlikeSearch          — 단순 OR ilike (orders/users 사용 · subscriptions 직접)

   ADR-009 §2-2 Candidate A 보완: 풀 factory 폐기 + helper 추출로 대체.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 어드민 리스트 fetch 결과 — 3 도메인 (orders/users/subscriptions) 공통 shape.
 *
 * - rows    : 페이지 행 (`mapXxx` 매핑 후)
 * - total   : filter 적용 전체 건수 (`count: 'exact'`)
 * - counts  : 탭별 카운트 (도메인별 status enum)
 * - filters : 파싱된 search params (`parseSearchParams` 결과)
 */
export type AdminListResult<T, S extends string, F> = {
  rows: T[];
  total: number;
  counts: Record<S, number>;
  filters: F;
};

/**
 * 1-base `page` + `pageSize` → Supabase `range(offset, offset+size-1)`.
 *
 * 답습 3 도메인 동일 패턴:
 * ```ts
 * const offset = (filters.page - 1) * PAGE_SIZE;
 * query.range(offset, offset + PAGE_SIZE - 1);
 * ```
 */
export function applyRange<Q extends { range(a: number, b: number): Q }>(
  query: Q,
  page: number,
  pageSize: number,
): Q {
  const offset = (page - 1) * pageSize;
  return query.range(offset, offset + pageSize - 1);
}

/**
 * 단순 OR ilike 부분일치 검색.
 *
 * - `qSafe` 빈 문자열이면 `query` 그대로 반환 (no-op)
 * - 호출처에서 `sanitizeSearchQuery` 적용 후 전달
 * - 복잡 검색 (예: subscriptions 의 profiles email pre-lookup) 은 사용 불가
 *   → 호출처에서 직접 작성
 *
 * 생성되는 절: `col1.ilike.%qSafe%,col2.ilike.%qSafe%,...`
 */
export function applyIlikeSearch<Q extends { or(s: string): Q }>(
  query: Q,
  qSafe: string,
  columns: readonly string[],
): Q {
  if (qSafe.length === 0) return query;
  return query.or(columns.map((c) => `${c}.ilike.%${qSafe}%`).join(','));
}
