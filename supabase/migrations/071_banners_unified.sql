-- ═══════════════════════════════════════════════════════════════════════════
-- 071_banners_unified.sql — Y1 banners 통합 테이블 (S269)
--
-- 배경:
--   - cafe_events (035 + 060 + 061 + 064 + 068) 와 site_settings.signature
--     (062 + 063 + 068) 가 14 공통 필드 100% 동일 (custom_html_path +
--     image_path × 3 + image_blur × 3 + aspect × 3 + image_alt + SEO 메타 4종).
--   - S269 결정 Y1 — 두 도메인을 banners 단일 테이블 + kind enum 으로 통합.
--   - Schema DRY · 미래 배너 (회원모집 / 공지 / 굿데이즈 안내 등) 확장
--     자연 + 운영자 멘탈 모델 (kind 분기) 단순화.
--
-- 본 마이그 책임 (data 0):
--   1) banner_kind enum 신설 ('cafe_event' | 'signature')
--   2) banners 테이블 신설 (14 공통 + cafe 분기 nullable + 기간 + sort)
--   3) RLS (admin write / public read · cafe_events 답습)
--   4) updated_at trigger (cafe_events 답습)
--   5) Storage 버킷 'banners' 신설 + RLS (028 답습)
--   6) partial UNIQUE INDEX — signature kind 단일 row 보장
--   7) CHECK constraint — cafe_event 만 type 필수
--   8) Index — active 조회 가속 (kind + enabled + start_date + end_date)
--
-- 본 마이그 비책임 (별 마이그):
--   - 072: Storage 파일 이전 (cafe-events/* → banners/cafe-event/*,
--          season-banners/signature/* → banners/signature/*)
--   - 073: cafe_events / site_settings.signature → banners INSERT (data 이전)
--   - 074 (별 sprint): cafe_events drop + site_settings.signature row delete
--          + cafe-events / season-banners 버킷 폐기
--
-- 참조:
--   - 020_profiles_role_rbac.sql (is_admin)
--   - 028_admin_storage_buckets.sql (Storage 버킷 패턴)
--   - 035_cafe_events.sql (테이블 + RLS + trigger 패턴)
--   - 060/061_cafe_events_iframe.sql (iframe HTML 모델)
--   - 062_site_settings_signature_iframe.sql (signature payload)
--   - 064_cafe_events_seo_meta.sql + 063_site_settings_signature_seo_meta.sql
--   - 068_banner_image_blur.sql (LQIP)
--
-- Rollback:
--   drop table banners;
--   drop type banner_kind;
--   delete from storage.buckets where id = 'banners';
--   -- (RLS 정책은 storage.objects drop 으로 함께 정리)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. banner_kind enum ─────────────────────────────────────────────────
-- 미래 확장: 'membership' | 'notice' | 'gooddays_promo' 등 ADD VALUE 가능.
-- cafe_event_type enum (035) 은 별개 — banners.type 컬럼이 그 enum 을 참조.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'banner_kind') then
    create type public.banner_kind as enum (
      'cafe_event',
      'signature'
    );
  end if;
end $$;

comment on type public.banner_kind is
  '배너 종류 — 메인 페이지의 어느 chapter 에 노출되는지 결정. '
  'cafe_event = §2.5 카페 메뉴 chapter row. signature = §2.2 단독 chapter. '
  '미래 확장 가능 (membership / notice / gooddays_promo 등).';

-- ── 2. banners 테이블 ───────────────────────────────────────────────────
create table if not exists public.banners (
  id                uuid                primary key default gen_random_uuid(),
  kind              banner_kind         not null,
  enabled           boolean             not null default true,

  -- ── 공통 14 필드 (cafe_events + signature 동일) ─────────────────────────

  -- iframe HTML 모델 (060/062)
  custom_html_path  text                not null default '',

  -- 이미지 3종 (061)
  image_path_desktop text               not null default '',
  image_path_tablet  text               not null default '',
  image_path_mobile  text               not null default '',

  -- LQIP base64 dataURL (068)
  image_blur_desktop text               not null default '',
  image_blur_tablet  text               not null default '',
  image_blur_mobile  text               not null default '',

  -- iframe 컨테이너 aspect-ratio (CSS "W/H")
  aspect_desktop    text                not null default '1320/600',
  aspect_tablet     text                not null default '1024/520',
  aspect_mobile     text                not null default '390/520',

  -- 접근성
  image_alt         text                not null default '',

  -- SEO 메타 슬롯 (063 + 064 · iframe 외부 sr-only 출력)
  headline_text     text                not null default '',
  subhead_text      text                not null default '',
  cta_text          text                not null default '',
  cta_href          text                not null default '',

  -- ── 기간 / 정렬 (signature 도 무입력 = 영구 active) ──────────────────────
  start_date        date,
  end_date          date,
  sort_order        integer             not null default 0,

  -- ── cafe_event 분기 필드 (signature 는 NULL) ────────────────────────────
  -- type 5-enum (035 cafe_event_type 재사용). 059 에서 type 분기 필드 4종
  -- (recurring / linked_menu_slug / season_label / partner_name) 은 이미 DROP.
  -- 현재 cafe_events 본체에도 없는 컬럼이므로 banners 에서도 추가하지 않음 (YAGNI).
  type              cafe_event_type,

  -- ── 감사 ─────────────────────────────────────────────────────────────
  created_at        timestamptz         not null default now(),
  updated_at        timestamptz         not null default now(),
  updated_by        uuid                references auth.users(id) on delete set null
);

comment on table public.banners is
  'Y1 통합 배너 테이블 (S269). kind 로 cafe_event / signature 분기. '
  '14 공통 필드 + cafe_event 분기 nullable. signature 는 partial UNIQUE 로 1 row 보장.';

comment on column public.banners.kind is
  '배너 종류. cafe_event 는 복수 row + 우선순위 (selectActiveBanner). '
  'signature 는 partial UNIQUE 로 1 row 만 허용.';
comment on column public.banners.custom_html_path is
  '운영자 .html 파일 Storage URL (banners/{kind}/html/*). '
  '<iframe sandbox srcDoc> 임베드. 이미지/CSS/SVG/폰트 모두 HTML 내부에서 처리.';
comment on column public.banners.image_path_desktop is
  '데스크탑 이미지 Storage URL (banners/{kind}/images/desktop/*). '
  '운영자 HTML 안 {{IMAGE_DESKTOP}} placeholder 와 치환.';
comment on column public.banners.start_date is
  '활성 시작일 (자문 §5.3 active 판정). NULL = 영구 active (signature 시 자연 동작).';
comment on column public.banners.end_date is
  '활성 종료일. NULL = 영구 active.';
comment on column public.banners.type is
  'cafe_event 전용 분류 (campaign/collab/seasonal/new_item/oneplus). '
  'signature kind 일 때는 NULL (CHECK constraint 로 enforce).';

-- ── 3. CHECK constraint — cafe_event 만 type 필수 ───────────────────────
alter table public.banners
  add constraint banners_cafe_event_type_required
  check (kind != 'cafe_event' or type is not null);

comment on constraint banners_cafe_event_type_required on public.banners is
  'kind=cafe_event 인 row 는 반드시 type 필수. signature 는 NULL.';

-- ── 4. Partial UNIQUE — signature 단일 row 보장 ─────────────────────────
-- 운영 모델: signature 는 단일 인스턴스 (시즌 갱신은 같은 row 값 갈아끼움 또는
-- 신규 row 추가 후 구 row 삭제). 어드민 UX 측에서 1 row 만 노출.
-- 다만 partial UNIQUE 로 DB 레벨 안전망 추가.
create unique index if not exists banners_only_one_signature
  on public.banners (kind)
  where kind = 'signature';

comment on index public.banners_only_one_signature is
  'signature kind 단일 row 보장 (운영자 실수로 복수 row 생성 차단).';

-- ── 5. Index — active 조회 가속 ─────────────────────────────────────────
create index if not exists banners_kind_active
  on public.banners (kind, enabled, start_date, end_date)
  where enabled = true;

comment on index public.banners_kind_active is
  'selectActiveBanner(kind, today) 조회 가속. enabled=true 만 포함.';

-- ── 6. RLS ──────────────────────────────────────────────────────────────
alter table public.banners enable row level security;

-- SELECT — public (anon 포함). 메인 사이트 SSR fetch.
create policy "banners_select_public"
  on public.banners for select
  to public
  using (true);

comment on policy "banners_select_public" on public.banners is
  '모든 사용자 조회 가능. 공개 정보.';

-- INSERT/UPDATE/DELETE — admin only.
create policy "banners_insert_admin"
  on public.banners for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "banners_update_admin"
  on public.banners for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "banners_delete_admin"
  on public.banners for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ── 7. updated_at 트리거 ────────────────────────────────────────────────
create or replace function public.set_banners_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_banners_updated_at on public.banners;
create trigger trg_banners_updated_at
  before update on public.banners
  for each row
  execute function public.set_banners_updated_at();

-- ── 8. Storage 버킷 'banners' ────────────────────────────────────────────
-- prefix 규약:
--   banners/cafe-event/images/{desktop|tablet|mobile}/{timestamp-filename}
--   banners/cafe-event/html/{timestamp-filename}
--   banners/signature/images/{desktop|tablet|mobile}/{timestamp-filename}
--   banners/signature/html/{timestamp-filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'banners',
    'banners',
    true,
    5242880, -- 5MB
    array['image/webp','image/avif','image/jpeg','image/png','text/html']
  )
on conflict (id) do nothing;

-- ── 9. Storage RLS — banners 버킷 ───────────────────────────────────────
create policy "banners admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'banners'
  and public.is_admin(auth.uid())
);

create policy "banners admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'banners'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'banners'
  and public.is_admin(auth.uid())
);

create policy "banners admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'banners'
  and public.is_admin(auth.uid())
);

create policy "banners public read"
on storage.objects for select
to public
using (bucket_id = 'banners');
