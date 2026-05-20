-- ═══════════════════════════════════════════════════════════════════════════
-- 065_newsletter_subscribers.sql — newsletter 구독자 테이블 (S241 D-25)
--
-- 배경:
--   - NewsletterSection (메인 5섹션 마지막 dark CTA) submit UI only → DB 미연결.
--   - 유저 데이터(auth.users / profiles)와는 별도 테이블로 운영 — 비회원 + 회원
--     모두 같은 테이블에 저장. 회원은 user_id FK 연결.
--   - 발송은 Resend (별도 sprint). 현재는 데이터 수집 + 회원 토글 토대 구축.
--
-- 컬럼:
--   - email (unique) — 구독 식별자
--   - user_id (nullable FK) — 회원 연결 (비회원 = null)
--   - status (active/unsubscribed) — 구독 상태
--   - source (newsletter_form/signup_default/admin/other) — 유입 경로 추적
--   - created_at / updated_at
--
-- RLS:
--   - anon · authenticated: INSERT 허용 (newsletter form 구독)
--   - authenticated: 자기 user_id record UPDATE/SELECT (Phase 2 토글)
--   - admin: SELECT/UPDATE/DELETE 전체 (구독자 관리)
--
-- 중복 처리:
--   - INSERT 시 email unique 충돌 → ON CONFLICT (email) DO UPDATE 로 status='active'
--     복원 (재구독). Server Action 측에서 처리.
--
-- Rollback:
--   - DROP TABLE public.newsletter_subscribers CASCADE (데이터 손실).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  source text not null default 'newsletter_form' check (source in ('newsletter_form', 'signup_default', 'admin', 'other')),
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'newsletter 구독자 — 비회원(user_id null) + 회원(user_id FK). 발송은 Resend (별도).';
comment on column public.newsletter_subscribers.email is
  '구독 식별자 (unique). 회원/비회원 공통.';
comment on column public.newsletter_subscribers.user_id is
  '회원 연결 (nullable). 비회원 구독 시 null. auth.users 삭제 시 null 로 (구독 자체 유지).';
comment on column public.newsletter_subscribers.status is
  'active = 발송 대상 / unsubscribed = 발송 제외 (회원 토글 OFF).';
comment on column public.newsletter_subscribers.source is
  '유입 경로 — newsletter_form (메인 폼) / signup_default (가입 시 자동 ON) / admin / other.';
comment on column public.newsletter_subscribers.unsubscribe_token is
  '발송 메일 footer 의 unsubscribe 링크 토큰. /unsubscribe?token=... 진입 시 매치 → status=unsubscribed. RFC 2369 List-Unsubscribe header 와도 호환.';

create index if not exists newsletter_subscribers_user_id_idx
  on public.newsletter_subscribers(user_id);
create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers(status);

-- updated_at trigger (set_updated_at 001 답습)
create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.newsletter_subscribers enable row level security;

-- (1) anon + authenticated INSERT — newsletter form 구독 (비회원 + 회원)
create policy "newsletter_anyone_insert"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- (2) authenticated UPDATE 자기 record — 회원 토글 (Phase 2)
create policy "newsletter_owner_update"
  on public.newsletter_subscribers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (3) authenticated SELECT 자기 record — 회원 자기 구독 상태 조회
create policy "newsletter_owner_select"
  on public.newsletter_subscribers
  for select
  to authenticated
  using (auth.uid() = user_id);

-- (4) admin SELECT 전체 — 구독자 관리
create policy "newsletter_admin_select"
  on public.newsletter_subscribers
  for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- (5) admin UPDATE/DELETE 전체 — 구독자 관리
create policy "newsletter_admin_update"
  on public.newsletter_subscribers
  for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "newsletter_admin_delete"
  on public.newsletter_subscribers
  for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ── RPC: 토큰 기반 unsubscribe (anon 접근 가능) ─────────────────────────────
-- 발송 메일의 /unsubscribe?token=<uuid> 진입 시 호출. SECURITY DEFINER 로 RLS 우회 +
-- 토큰 매치 + status='active' 일 때만 UPDATE → status='unsubscribed'.
-- 이미 unsubscribed 거나 토큰 불일치 시 false 반환 (graceful).
create or replace function public.unsubscribe_by_token(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_subscribers
  set status = 'unsubscribed'
  where unsubscribe_token = p_token
    and status = 'active';

  return found;
end;
$$;

comment on function public.unsubscribe_by_token(uuid) is
  '발송 메일 unsubscribe 링크 처리 (anon 접근). 토큰 매치 + active 일 때만 UPDATE. SECURITY DEFINER.';

grant execute on function public.unsubscribe_by_token(uuid) to anon, authenticated;
