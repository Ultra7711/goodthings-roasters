-- ═══════════════════════════════════════════════════════════════════════════
-- 036_gooddays_gallery.sql — 굿데이즈 갤러리 row 저장소 (S167 J-1)
--
-- 목적:
--   - 기존 lib/gooddays.ts 의 hardcoded GD_IMAGES (42장) 를 DB 로 이관.
--   - /admin/gooddays 어드민 UI 에서 업로드·정렬·on/off·삭제 운영 가능 상태 확보.
--   - LQIP (blur_data_url + width + height) 컬럼 직접 저장 — 어드민 업로드 즉시 반영.
--
-- 설계 결정 (S167):
--   - sort_order UNIQUE DEFERRABLE INITIALLY DEFERRED — 드래그 리오더 시
--     일괄 UPDATE 가 트랜잭션 종료 시점에 unique 검증 → 중간 상태 충돌 회피.
--   - featured boolean — 매거진 패턴 (gd-row--a/c) 의 span 슬롯 우선 배치.
--     pattern (5종 row) 자체는 hardcoded 유지 (다음 sprint 후보).
--   - is_active boolean — on/off 토글. /gooddays SSR fetch 가 active 만 조회.
--   - url 직접 저장 — Storage public bucket (gooddays-images, 028 마이그레이션).
--
-- 참조:
--   - 020_profiles_role_rbac.sql      (is_admin 헬퍼)
--   - 028_admin_storage_buckets.sql   (gooddays-images 버킷 사전 생성)
--   - 035_cafe_events.sql             (테이블·RLS·트리거 패턴)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 ───────────────────────────────────────────────────────────
create table if not exists public.gooddays_gallery (
  id              uuid          primary key default gen_random_uuid(),

  -- 이미지 (Storage public URL)
  url             text          not null,
  alt             text          not null default '',

  -- 정렬·on/off·featured
  sort_order      integer       not null,
  is_active       boolean       not null default true,
  featured        boolean       not null default false,

  -- LQIP (sharp 추출 — yet-another-react-lightbox Zoom plugin 활성화 조건)
  blur_data_url   text          not null,
  width           integer       not null,
  height          integer       not null,

  -- 감사
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),
  updated_by      uuid          references auth.users(id) on delete set null,

  constraint gooddays_gallery_sort_order_unique
    unique (sort_order) deferrable initially deferred,

  constraint gooddays_gallery_dim_positive check (width > 0 and height > 0)
);

comment on table public.gooddays_gallery is
  '굿데이즈 갤러리 이미지 row. /gooddays SSR fetch + /admin/gooddays 운영.';
comment on column public.gooddays_gallery.url is
  'Storage public URL (gooddays-images 버킷 직접 노출).';
comment on column public.gooddays_gallery.sort_order is
  '갤러리 매거진 그리드 배치 순서. UNIQUE DEFERRABLE — 드래그 리오더 일괄 UPDATE 지원.';
comment on column public.gooddays_gallery.featured is
  '매거진 pattern (gd-row--a/c) 의 span 슬롯 우선 배치 플래그.';
comment on column public.gooddays_gallery.blur_data_url is
  'LQIP base64 (sharp 추출). Next/Image placeholder=blur 와 lightbox blur 슬라이드 양쪽 사용.';

-- 부분 인덱스 — /gooddays SSR active 조회 가속
create index if not exists idx_gooddays_gallery_active
  on public.gooddays_gallery (sort_order)
  where is_active = true;

-- ── 2. RLS ──────────────────────────────────────────────────────────────
alter table public.gooddays_gallery enable row level security;

-- SELECT — public (anon 포함). /gooddays SSR fetch.
create policy "gooddays_gallery_select_public"
  on public.gooddays_gallery for select
  to public
  using (true);

comment on policy "gooddays_gallery_select_public" on public.gooddays_gallery is
  '모든 사용자 조회 가능. /gooddays 는 anon 포함 공개 라우트.';

-- INSERT/UPDATE/DELETE — admin only.
create policy "gooddays_gallery_insert_admin"
  on public.gooddays_gallery for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

create policy "gooddays_gallery_update_admin"
  on public.gooddays_gallery for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "gooddays_gallery_delete_admin"
  on public.gooddays_gallery for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ── 3. updated_at 트리거 ────────────────────────────────────────────────
create or replace function public.set_gooddays_gallery_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_gooddays_gallery_updated_at on public.gooddays_gallery;
create trigger trg_gooddays_gallery_updated_at
  before update on public.gooddays_gallery
  for each row
  execute function public.set_gooddays_gallery_updated_at();
