-- ═══════════════════════════════════════════════════════════════════════════
-- 009_security_hardening.sql — P0 검증 후 발견된 보안·일관성 이슈 보정
--
-- 대상 이슈 (2026-04-16 P0 검증):
--   - Issue A (Security WARN): prevent_id_change 함수의 search_path mutable
--     → supabase db advisors 가 function_search_path_mutable WARN 감지
--     → SECURITY DEFINER 함수와 동일 수준의 방어 적용 (검색 경로 고정)
--   - Issue B (일관성): orders 테이블에 prevent_id_change 트리거 미부착
--     → profiles/addresses/subscriptions 와 일관되게 추가
--
-- 영향도:
--   - 기존 데이터·정책·RLS 에 변경 없음
--   - 함수 본문 동일 — search_path 고정만 추가
--   - orders 트리거는 INSERT 시 미발동, UPDATE 시에만 id 변경 차단
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Issue A: prevent_id_change search_path 고정 ──────────────────────────
-- SECURITY DEFINER 는 아니지만 Supabase Security Lint (0011) 가이드 준수.
-- 검색 경로 하이재킹 공격 방지 — `set search_path` 로 고정.
create or replace function public.prevent_id_change ()
  returns trigger
  language plpgsql
  set search_path = public, pg_catalog
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'id 컬럼은 변경할 수 없습니다. (invariant)';
  end if;
  return new;
end;
$$;

comment on function public.prevent_id_change () is
  'PK id UPDATE 차단. 009 에서 search_path 고정 추가 (Supabase Lint 0011 대응).';

-- ── Issue B: orders 테이블 prevent_id_change 트리거 추가 ─────────────────
-- 다른 테이블과 동일한 방어 패턴 적용.
-- UPDATE 는 RLS default-deny 로 service_role 전용이지만, 이중 방어.
drop trigger if exists orders_prevent_id_change on public.orders;

create trigger orders_prevent_id_change
  before update on public.orders
  for each row execute function public.prevent_id_change();
