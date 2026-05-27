-- ═══════════════════════════════════════════════════════════════════════════
-- 035_cafe_events.sql — 카페 메뉴 chapter 이벤트 row (S149 V2 §2.5 PR-1a)
--
-- 목적:
--   - advisory-E §3 권고 — 메인 §2.5 카페 메뉴 chapter 안 sand 단독 row.
--   - cream chapter (헤더 → 이벤트 row → split) 의 "이벤트 row" 데이터 저장소.
--   - 자유 슬롯 (분기당 0~3 · 동시 활성 max 1 — 자문 §5.3).
--
-- 설계 결정 (S149):
--   - site_settings 의 key/value 패턴 ✗ → 별도 테이블 (복수 row 가능).
--     · 자문 §5.3 "active 1개 (start ≤ today ≤ end). 복수 활성 시 start 최신,
--       동률 시 type 우선순위" → row-per-event 필수.
--   - type 5-enum (1+1 / 신메뉴 / 시즌 한정 / 콜라보 + **campaign**).
--     · campaign = 자문 4 type 외 운영 캠페인 (가족 동반 1잔 무료 등).
--     · 사용자 결정: 자문 권고 4 type 어디에도 정확히 안 맞는 케이스 위해 추가.
--   - 우선순위 (자문 §5.3 + campaign 가장 높음):
--       campaign → collab → seasonal → new_item → oneplus
--   - type 분기 필드는 nullable column (jsonb ✗ — 검색·정렬 단순).
--
-- schema 요약 (lib/cafeEvents.ts CafeEventSchema 와 1:1):
--   { id, type, enabled, eyebrow, h4, meta, desc,
--     image_path, image_alt, start_date, end_date,
--     recurring, linked_menu_slug, season_label, partner_name,
--     cta_target, sort_order, created_at, updated_at, updated_by }
--
-- 참조:
--   - 020_profiles_role_rbac.sql      (is_admin 헬퍼)
--   - 028_admin_storage_buckets.sql   (storage 버킷 패턴)
--   - 032_site_settings.sql           (RLS 정책 패턴)
--   - memory/project_session148_complete.md (advisory-E 통합 시작점)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. type enum ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cafe_event_type') then
    create type public.cafe_event_type as enum (
      'campaign',  -- 운영 캠페인 (가정의 달 등 4 type 외)
      'collab',    -- 콜라보
      'seasonal',  -- 시즌 한정
      'new_item',  -- 신메뉴
      'oneplus'    -- 1+1
    );
  end if;
end $$;

comment on type public.cafe_event_type is
  '카페 메뉴 chapter 이벤트 type. 우선순위: campaign > collab > seasonal > new_item > oneplus.';

-- ── 2. 테이블 ───────────────────────────────────────────────────────────
create table if not exists public.cafe_events (
  id                uuid                primary key default gen_random_uuid(),
  type              cafe_event_type     not null,
  enabled           boolean             not null default true,

  -- 카피 (자문 §3.2 + §3.4)
  eyebrow           text                not null default '',  -- "Now On · ~5/31"
  h4                text                not null default '',  -- max 22자
  meta              text                not null default '',  -- max 80자
  description       text                not null default '',  -- max 80자 1~2줄

  -- 이미지 (1:1 정사각)
  image_path        text                not null default '',
  image_alt         text                not null default '',

  -- 기간
  start_date        date,
  end_date          date,

  -- type 분기 필드 (nullable)
  recurring         text,               -- oneplus: "weekly_tuesday" 등
  linked_menu_slug  text,               -- new_item: 메뉴 slug
  season_label      text,               -- seasonal: "Spring" / "May" 등
  partner_name      text,               -- collab: 파트너명

  -- CTA (null = 버튼 없음)
  cta_target        text,

  -- 정렬 (동일 우선순위 내 fallback)
  sort_order        integer             not null default 0,

  -- 감사
  created_at        timestamptz         not null default now(),
  updated_at        timestamptz         not null default now(),
  updated_by        uuid                references auth.users(id) on delete set null
);

comment on table public.cafe_events is
  'V2 §2.5 카페 메뉴 chapter 이벤트 row. 자문 §3 spec.';
comment on column public.cafe_events.h4 is
  'max 22자 권고 (자문 §3.2). chapter 모바일 wrap 깨짐 방지.';
comment on column public.cafe_events.description is
  'max 80자 권고 (자문 §3.2). 1~2줄.';
comment on column public.cafe_events.cta_target is
  'NULL 이면 CTA 버튼 없음. inline accordion 또는 /events/{slug}.';
comment on column public.cafe_events.sort_order is
  '동일 우선순위 내 정렬 fallback. 작은 값이 먼저.';

-- 인덱스 — active 이벤트 조회 가속
create index if not exists idx_cafe_events_active
  on public.cafe_events (enabled, start_date, end_date)
  where enabled = true;

-- ── 3. RLS ──────────────────────────────────────────────────────────────
alter table public.cafe_events enable row level security;

-- SELECT — public (anon 포함). 메인 사이트 SSR fetch.
create policy "cafe_events_select_public"
  on public.cafe_events for select
  to public
  using (true);

comment on policy "cafe_events_select_public" on public.cafe_events is
  '모든 사용자 조회 가능. 공개 정보.';

-- INSERT/UPDATE/DELETE — admin only.
create policy "cafe_events_insert_admin"
  on public.cafe_events for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "cafe_events_update_admin"
  on public.cafe_events for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "cafe_events_delete_admin"
  on public.cafe_events for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ── 4. updated_at 트리거 ────────────────────────────────────────────────
create or replace function public.set_cafe_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cafe_events_updated_at on public.cafe_events;
create trigger trg_cafe_events_updated_at
  before update on public.cafe_events
  for each row
  execute function public.set_cafe_events_updated_at();

-- ── 5. Storage 버킷 (cafe-events) ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'cafe-events',
    'cafe-events',
    true,
    5242880, -- 5MB
    array['image/webp','image/avif','image/jpeg','image/png']
  )
on conflict (id) do nothing;

create policy "cafe-events admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cafe-events'
  and public.is_admin(auth.uid())
);

create policy "cafe-events admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'cafe-events'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'cafe-events'
  and public.is_admin(auth.uid())
);

create policy "cafe-events admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cafe-events'
  and public.is_admin(auth.uid())
);

create policy "cafe-events public read"
on storage.objects for select
to public
using (bucket_id = 'cafe-events');

-- ── 6. Seed (5월 가정의 달) ─────────────────────────────────────────────
-- 사용자 결정 (S149/S150):
--   - type = campaign
--   - 사진 = 카네이션/가족 일러스트 (next/public/images/cafe-events/family-month-2026-05.png)
--   - h4 = "가족과 함께라면, 음료 한 잔 더 무료" (S150 — "더" 추가, 마케팅 임팩트 ↑)
--   - desc = 부모+아이 그룹 트리거 (S150 — "또는 아이와" → "과 아이가" 정정)
--   - CTA 없음 (cta_target NULL)
insert into public.cafe_events (
  type, enabled, eyebrow, h4, meta, description,
  image_path, image_alt,
  start_date, end_date,
  season_label, sort_order
)
values
  (
    'campaign',
    true,
    'Now On · ~5/31',
    '가족과 함께라면, 음료 한 잔 더 무료',
    '5월 한 달 · 매장 한정 · 가족 동반',
    '부모님과 아이가 함께 방문하시면 음료 한 잔을 무료로 드립니다.',
    '/images/cafe-events/family-month-2026-05.png',
    '5월 가정의 달 이벤트 일러스트',
    '2026-05-01',
    '2026-05-31',
    'May',
    0
  )
on conflict do nothing;
