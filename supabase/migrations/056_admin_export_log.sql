-- ═══════════════════════════════════════════════════════════════════════════
-- 056_admin_export_log.sql — CSV 내보내기 영구 audit (S233-fu)
--
-- 배경:
--   - DEC-export-4 = PII 평문 + audit. 현재 console.log → Vercel log 30일+ 보존.
--   - 영구 보관 + 통합 조회 필요 (도메인 횡단 타임라인).
--
-- 정책:
--   - 모든 admin (owner/staff) 의 CSV 내보내기 행위 INSERT.
--   - SELECT = owner 만 (staff 가 다른 admin 행위 추적 못 함).
--   - INSERT = service_role 또는 admin (server action 측에서 직접 INSERT).
--   - DELETE/UPDATE = service_role 전용 (정책 미선언 = deny).
--
-- 컬럼:
--   - actor_id : 다운로드한 admin user_id (auth.users FK · cascade)
--   - domain   : 'subscriptions' | 'orders' (향후 'users' / 'products' 확장)
--   - filters  : 적용한 필터 jsonb (status / period / payment / q · 도메인 별 다름)
--   - row_count: 내보낸 행 수 (truncated 적용 후)
--   - truncated: 10K 한도 초과 여부 (boolean)
--   - created_at: KST 변환은 조회 측에서
-- ═══════════════════════════════════════════════════════════════════════════

create table public.admin_export_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users (id) on delete cascade,
  domain text not null check (domain in ('subscriptions', 'orders', 'users', 'products')),
  filters jsonb not null default '{}'::jsonb,
  row_count int not null check (row_count >= 0),
  truncated boolean not null default false,
  created_at timestamptz not null default now()
);

create index admin_export_log_actor_idx on public.admin_export_log (actor_id, created_at desc);
create index admin_export_log_domain_idx on public.admin_export_log (domain, created_at desc);
create index admin_export_log_created_idx on public.admin_export_log (created_at desc);

alter table public.admin_export_log enable row level security;
alter table public.admin_export_log force row level security;

-- SELECT — owner 만 (전체 admin 활동 통합 조회)
create policy "admin_export_log_select_owner"
  on public.admin_export_log for select
  to authenticated
  using (public.is_admin_owner((select auth.uid())));

-- INSERT — admin 인 actor 본인 행만 (server action 에서 호출)
create policy "admin_export_log_insert_admin_self"
  on public.admin_export_log for insert
  to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and actor_id = (select auth.uid())
  );

-- UPDATE/DELETE: 정책 미선언 = deny

comment on table public.admin_export_log is
  'CSV 내보내기 영구 audit (PII 다운로드 추적). RLS: owner SELECT · admin self INSERT · 그 외 deny.';
comment on column public.admin_export_log.filters is
  '내보내기 시 적용한 필터 (도메인 별 구조 다름). 예: orders = {status, period, payment, q}';
