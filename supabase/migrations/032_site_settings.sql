-- ═══════════════════════════════════════════════════════════════════════════
-- 032_site_settings.sql — 사이트 설정 (site_settings) 테이블 + RLS + seed (S129 Group H)
--
-- 목적:
--   - /admin/settings 가 편집하고 메인 사이트(B2C)가 fetch 하는 설정 저장소.
--   - 영역별 부분 업데이트 가능한 key/value JSONB 구조 (옵션 B).
--   - 새 설정 영역 추가 시 INSERT 만 (스키마 변경 불필요).
--
-- 설계 결정 (S129):
--   - 옵션 A 단일 row vs B key/value vs C 영역별 테이블 → B 채택.
--     · 영역별 부분 업데이트 (UPDATE WHERE key = 'notice') 가능
--     · 새 영역 추가 시 마이그레이션 없이 INSERT
--     · 단일 테이블 RLS 일관성
--   - SELECT public (anon 가능) — 공개 정보, 메인 사이트가 SSR fetch 하기 위함.
--   - INSERT/UPDATE/DELETE admin only (is_admin).
--
-- 영역 (seed):
--   - notice   : 공지 배너 (1줄 띠) — enabled · text · link · theme_idx
--   - season   : 시즌 배너 (홈 히어로) — enabled · title · subtitle · cta_text · cta_link · start_date · end_date · image_path · image_alt
--   - shipping : 무료배송 정책 — enabled · free_threshold · base_fee · notice_text
--
-- 참조:
--   - 020_profiles_role_rbac.sql      (is_admin 헬퍼)
--   - 028_admin_storage_buckets.sql   (season-banners 버킷 — H-3 에서 사용)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 ────────────────────────────────────────────────────────────
create table if not exists public.site_settings (
  key         text         primary key,
  value       jsonb        not null default '{}'::jsonb,
  updated_at  timestamptz  not null default now(),
  updated_by  uuid         references auth.users(id) on delete set null
);

comment on table public.site_settings is
  '메인 사이트(B2C) 설정 저장소. /admin/settings 가 편집, 메인 사이트가 SSR fetch.';
comment on column public.site_settings.key is
  '영역 식별자 (notice · season · shipping 등). 새 영역 추가 시 INSERT 만.';
comment on column public.site_settings.value is
  '영역별 JSONB payload. 스키마는 코드(lib/admin/siteSettings.ts) Zod 가 책임.';
comment on column public.site_settings.updated_by is
  '마지막 수정자 (감사 로그용). 사용자 삭제 시 NULL 로 보존.';

-- ── 2. RLS ───────────────────────────────────────────────────────────────
alter table public.site_settings enable row level security;

-- SELECT — public (anon 포함). 메인 사이트는 anon 클라이언트로 SSR fetch.
create policy "site_settings_select_public"
  on public.site_settings for select
  to public
  using (true);

comment on policy "site_settings_select_public" on public.site_settings is
  '모든 사용자(anon 포함) 조회 가능. 공개 정보 (공지·시즌 배너·무료배송 임계값 등).';

-- INSERT — admin only.
create policy "site_settings_insert_admin"
  on public.site_settings for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

comment on policy "site_settings_insert_admin" on public.site_settings is
  '어드민만 새 영역 INSERT 가능. 일반 사용자는 INSERT 거부.';

-- UPDATE — admin only.
create policy "site_settings_update_admin"
  on public.site_settings for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

comment on policy "site_settings_update_admin" on public.site_settings is
  '어드민만 UPDATE 가능. /admin/settings 편집 작업.';

-- DELETE — admin only (영역 자체 제거. 운영 상 거의 안 쓰지만 RBAC 일관성).
create policy "site_settings_delete_admin"
  on public.site_settings for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

comment on policy "site_settings_delete_admin" on public.site_settings is
  '어드민만 영역 삭제 가능. 일반적으로 사용하지 않음 (영역 토글은 value.enabled 로 제어).';

-- ── 3. updated_at 자동 갱신 트리거 ───────────────────────────────────────
create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_site_settings_updated_at();

-- ── 4. Seed (3 영역) ─────────────────────────────────────────────────────
-- 현재 메인 사이트 hardcoded 값을 기본값으로 시드.
-- 어드민이 한번도 저장 안 한 상태에서도 정상 동작 보장.
insert into public.site_settings (key, value)
values
  -- notice : AnnouncementBar (현재 hardcoded "30,000원 이상 구매 시 무료 배송")
  (
    'notice',
    jsonb_build_object(
      'enabled',    true,
      'text',       '30,000원 이상 구매 시 무료 배송',
      'secondary',  'Specialty Coffee For All',
      'link',       '',
      'theme_idx',  0
    )
  ),
  -- season : 시즌 배너 (현재 hardcoded "2026 · SPRING — 봄, 한 잔의 여유.")
  (
    'season',
    jsonb_build_object(
      'enabled',    true,
      'eyebrow',    '2026 · SPRING',
      'title',      '봄, 한 잔의 여유.',
      'subtitle',   '벚꽃이 지기 전에 만나는 시즌 한정 메뉴',
      'cta_text',   '시즌 메뉴 보기',
      'cta_link',   '/menu?cat=signature',
      'start_date', '2026-03-01',
      'end_date',   '2026-05-31',
      'image_path', '/images/sections/img_season_banner.webp',
      'image_alt',  '시즌 메뉴'
    )
  ),
  -- shipping : 무료배송 정책 (현재 hardcoded FREE_SHIPPING_THRESHOLD = 30000 / SHIPPING_FEE)
  (
    'shipping',
    jsonb_build_object(
      'enabled',         true,
      'free_threshold',  30000,
      'base_fee',         3500,
      'notice_text',     '₩30,000 이상 무료배송 · 평일 14시 이전 주문 당일 출고'
    )
  )
on conflict (key) do nothing;
