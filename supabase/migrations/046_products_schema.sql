-- ═══════════════════════════════════════════════════════════════════════════
-- 046_products_schema.sql — Group E 상품 도메인 DB 스키마 (S211 진입)
--
-- 목적:
--   `next/src/lib/products.ts` (339줄) 하드코딩 PRODUCTS 배열을 DB 로 이관.
--   어드민에서 가격 / 신상품 / 옵션 / 이미지 / 레시피 편집 가능.
--   S209 재계획 결정 — 출시 전 처리 확정 (DEC-1).
--
-- 변경 사항:
--   1) products 테이블 — 상품 메인 (slug PK · category · status · note · roast 등)
--   2) product_volumes 테이블 — 1:N 옵션 (200g / 500g / 1kg 등 · 가격 · 옵션별 품절)
--   3) product_images 테이블 — 1:N 이미지 (src · bg · bgTheme · LQIP blur_data_url)
--   4) product_recipes 테이블 — 1:N 추출 가이드 (method · dose · temp · time · water)
--
-- 보안 결정:
--   - SELECT: public (anon + authenticated) — `is_active = true` 필터
--   - INSERT / UPDATE / DELETE: admin only (`public.is_admin(auth.uid())` — 020 헬퍼)
--   - product_volumes / product_images / product_recipes: SELECT public (all rows) +
--     write admin only — 상위 products.is_active 가 화면 노출 게이트
--
-- 결정 사항 (S209 재계획):
--   - DEC-3: Subscription 스냅샷 유지 → 046 에 subscriptions FK 도입 안 함.
--     subscriptions 테이블의 product_slug / product_name / product_image_src 컬럼
--     은 그대로 유지 (5 줄 컬럼 변경 0).
--   - DEC-5: 이미지 경로 = public/ 유지. `product_images.src` = `/images/products/...`
--     형식 text 컬럼 (varchar(256))
--   - DEC-6: LQIP blur = build-time. seed 시점에 `blur_data_url` / `width` / `height`
--     채우기. admin 신규 등록 시 sharp+plaiceholder 동적 생성은 Phase 3-D.
--
-- 의존:
--   - 001_profiles.sql (is_admin 020 헬퍼 의존)
--   - 020_profiles_role_rbac.sql (`public.is_admin(uuid)` 헬퍼)
--
-- 후속 (S211):
--   - S211 — types/product.ts + lib/productsServer.ts + seed 스크립트 + blur 채우기
--   - S212 — 36 의존 파일 productsServer 마이그 + PDP/결제/검색 회귀
--
-- 참조:
--   - memory/project_release_blocker_sprint.md §S211
--   - docs/admin-implementation-plan.md Group E
--   - supabase/migrations/README.md (운영 워크플로우)
--
-- DRIP_BAG_RECIPE (코드 상수 유지):
--   `next/src/lib/products.ts` 의 `DRIP_BAG_RECIPE` (4-step + tip) 은 본 마이그에
--   포함하지 않음. 단일 row 데이터 + 운영자 편집 빈도 낮음. Phase 3-D 어드민
--   SOP 와 함께 별도 마이그 (drip_bag_recipe 또는 site_settings) 로 처리.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. products 테이블 ─────────────────────────────────────────────────────
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),

  -- URL · 검색 키. 020 admin · cart · subscriptions 스냅샷이 의존
  slug              text not null unique,

  -- 카테고리 — UI 표시 'Coffee Bean' / 'Drip Bag' 은 코드에서 매핑
  category          text not null
    check (category in ('coffee_bean', 'drip_bag')),

  -- 상품명 (한·영 혼합 — "가을의 밤 Autumn Night")
  name              text not null,

  -- 디스플레이 가격 (목록 카드용 — "14,000원" 등)
  -- 실제 가격은 product_volumes.price (정수 KRW)
  display_price     text not null,

  -- 카드 배경 CSS gradient
  color             text not null,

  -- 배지 상태 — nullable text (코드 enum: 'NEW' / '인기 NO.1' / '인기 NO.2' /
  -- '인기 NO.3' / '수량 한정' / '품절'). NULL = 배지 미표시
  status            text
    check (status in ('NEW', '인기 NO.1', '인기 NO.2', '인기 NO.3', '수량 한정', '품절') or status is null),

  -- 정기배송 신청 가능 여부
  subscription      boolean not null default true,

  -- 팝업 안내 표시
  popup             boolean not null default false,

  -- 본문 설명 (멀티라인 OK)
  description       text not null,

  -- 스펙 ("블렌드: ... · 원산지: ... · 로스팅 포인트: ...")
  specs             text not null,

  -- 플레이버 노트 5축 레이더 (0.0 ~ 5.0)
  note_sweet        numeric(2, 1) not null check (note_sweet between 0 and 5),
  note_body         numeric(2, 1) not null check (note_body between 0 and 5),
  note_aftertaste   numeric(2, 1) not null check (note_aftertaste between 0 and 5),
  note_aroma        numeric(2, 1) not null check (note_aroma between 0 and 5),
  note_acidity     numeric(2, 1) not null check (note_acidity between 0 and 5),

  -- 노트 태그 (한·영)
  note_tags         text not null,
  note_tags_en      text not null,

  -- 플레이버 한 줄 설명
  flavor_desc       text not null,

  -- 노트 색상 hex (현재 모두 "#A47146")
  note_color        text not null default '#A47146',

  -- 로스팅 단계
  roast_stage       text not null
    check (roast_stage in ('light', 'medium-light', 'medium', 'medium-dark', 'dark', 'italian')),

  -- 목록 정렬 우선순위 (낮을수록 앞)
  sort_order        integer not null default 0,

  -- 어드민 숨김 토글 (상품 자체 노출 ON/OFF)
  -- status='품절' (sold-out 표시) 과는 다른 의미. is_active=false 면 검색·목록 노출 0.
  is_active         boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 인덱스
create index if not exists products_category_idx
  on public.products (category)
  where is_active = true;

create index if not exists products_sort_order_idx
  on public.products (sort_order, created_at desc)
  where is_active = true;

create index if not exists products_subscription_idx
  on public.products (subscription)
  where is_active = true and subscription = true;

-- 검색 인덱스 — name / note_tags / description trigram (Group E searchData 통합 시 활용)
-- pg_trgm extension 활성화 필요 (이미 존재 가정)
create extension if not exists pg_trgm;

create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);

create index if not exists products_note_tags_trgm_idx
  on public.products using gin (note_tags gin_trgm_ops);

-- 트리거 — updated_at 자동 갱신 (set_updated_at 함수 001 마이그 의존)
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger products_prevent_id_change
  before update on public.products
  for each row execute function public.prevent_id_change();

comment on table public.products is
  '상품 카탈로그 (Coffee Bean · Drip Bag). lib/products.ts 하드코딩 이관 (S211).';
comment on column public.products.slug is
  'URL · 검색 키. cart_items.product_slug · subscriptions.product_slug 가 참조 (FK 없는 스냅샷).';
comment on column public.products.status is
  '배지 상태. NULL = 배지 미표시. ''품절'' 은 전체 품절. 옵션별 품절은 product_volumes.sold_out.';
comment on column public.products.is_active is
  '어드민 숨김 토글. false 면 검색·목록 노출 0 (status=품절 과 다름).';


-- ── 2. product_volumes 테이블 (1:N — 옵션) ─────────────────────────────────
create table if not exists public.product_volumes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,

  -- 옵션 라벨 ("200g" / "500g" / "1kg" / "1개" / "5개" / "10개")
  label       text not null,

  -- 가격 (KRW 정수)
  price       integer not null check (price >= 0),

  -- 옵션별 품절 (예: "10개" 만 품절)
  sold_out    boolean not null default false,

  -- 옵션 정렬 (낮을수록 앞 — 작은 용량부터)
  sort_order  integer not null default 0,

  -- 동일 상품 내 옵션 라벨 중복 금지
  unique (product_id, label)
);

create index if not exists product_volumes_product_id_idx
  on public.product_volumes (product_id, sort_order);

comment on table public.product_volumes is
  '상품 옵션 (용량 / 개수 + 가격). 옵션별 sold_out 토글.';


-- ── 3. product_images 테이블 (1:N — 갤러리) ────────────────────────────────
create table if not exists public.product_images (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,

  -- 이미지 경로 — public/ 유지 (DEC-5). "/images/products/pd_img_xxx.webp"
  src             varchar(256) not null,

  -- 카드 배경 hex ("#ebebeb")
  bg              text not null,

  -- 배경 테마 (라이트 카드 / 다크 카드)
  bg_theme        text not null
    check (bg_theme in ('light', 'dark')),

  -- LQIP blur (DEC-6) — build-time `gen:image-blur` 가 seed 시점에 채움
  blur_data_url   text,
  width           integer,
  height          integer,

  -- 갤러리 순서 (낮을수록 앞 — 메인 이미지가 0)
  sort_order      integer not null default 0
);

create index if not exists product_images_product_id_idx
  on public.product_images (product_id, sort_order);

comment on table public.product_images is
  '상품 이미지 갤러리. src = public/ 경로 (Storage 미사용 — DEC-5). LQIP 컬럼은 build-time seed.';
comment on column public.product_images.blur_data_url is
  'LQIP base64 data URL (sharp+plaiceholder 생성). seed 시점에 채움 (DEC-6).';


-- ── 4. product_recipes 테이블 (1:N — 추출 가이드) ──────────────────────────
-- Coffee Bean 만 사용 (Drip Bag 은 코드 상수 DRIP_BAG_RECIPE 유지)
create table if not exists public.product_recipes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,

  -- 추출 방식 ("에어로프레스" / "에스프레소" / "모카포트" / "드립")
  method      text not null,

  -- 분량 ("15g" / "18~20g")
  dose        text not null,

  -- 온도 ("85~90°C")
  temp        text not null,

  -- 시간 ("1분~1분 30초")
  time        text not null,

  -- 물 ("120g" / "270~360g")
  water       text not null,

  -- 표시 순서
  sort_order  integer not null default 0,

  unique (product_id, method)
);

create index if not exists product_recipes_product_id_idx
  on public.product_recipes (product_id, sort_order);

comment on table public.product_recipes is
  'Coffee Bean 추출 가이드 (5 칼럼). Drip Bag 은 DRIP_BAG_RECIPE 코드 상수 유지.';


-- ── 5. RLS 정책 (DEC: SELECT public · write admin only) ────────────────────
-- products
alter table public.products enable row level security;

create policy products_select_public on public.products
  for select
  using (is_active = true or public.is_admin(auth.uid()));

create policy products_admin_all on public.products
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- product_volumes (상위 products 가 게이트. all rows SELECT 허용 — admin only write)
alter table public.product_volumes enable row level security;

create policy product_volumes_select_public on public.product_volumes
  for select using (true);

create policy product_volumes_admin_all on public.product_volumes
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- product_images
alter table public.product_images enable row level security;

create policy product_images_select_public on public.product_images
  for select using (true);

create policy product_images_admin_all on public.product_images
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- product_recipes
alter table public.product_recipes enable row level security;

create policy product_recipes_select_public on public.product_recipes
  for select using (true);

create policy product_recipes_admin_all on public.product_recipes
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- ── 6. seed 위치 안내 ──────────────────────────────────────────────────────
-- 상품 6종 (Coffee Bean 2 + Drip Bag 4) seed 는 본 마이그에 포함하지 않음.
-- S211 에서 별도 SQL 스크립트 또는 마이그로 처리:
--   - lib/products.ts PRODUCTS 배열 → INSERT
--   - scripts/generate-image-blur.mjs 확장 → blur_data_url / width / height 채우기
--   - subscriptions 스냅샷 정합 검증 (slug 변경 없음 — DEC-3)
