-- ═══════════════════════════════════════════════════════════════════════════
-- 047_cafe_menu_schema.sql — Group F 카페 메뉴 도메인 DB 스키마 (S213 진입)
--
-- 목적:
--   `next/src/lib/cafeMenu.ts` (180줄) 하드코딩 CAFE_MENU 배열을 DB 로 이관.
--   어드민에서 가격 / 신메뉴 / 영양정보 / 이미지 / 카테고리 편집 가능.
--   S209 재계획 결정 — 출시 전 처리 확정 (DEC-1).
--
-- 변경 사항:
--   1) cafe_menu_items 테이블 — 메뉴 메인 (id PK · cat · status · price · 영양정보)
--   2) cafe_menu_images 분리 안 함 — 메뉴당 이미지 1장 정책 (현 데이터 정합).
--      향후 다중 이미지 도입 시 별도 마이그.
--   3) menu_likes 테이블 (025 마이그) 와 menu_id text 매칭 — id 컬럼 text 유지.
--
-- 보안 결정:
--   - SELECT: public (anon + authenticated) — `is_active = true` 필터
--   - INSERT / UPDATE / DELETE: admin only (`public.is_admin(auth.uid())` — 020 헬퍼)
--
-- 결정 사항 (S209 재계획):
--   - DEC-5: 이미지 경로 = public/ 유지. `img_src` = `/images/cafe-menu/...` text 컬럼
--   - DEC-6: LQIP blur = build-time. seed 시점에 `blur_data_url` / `width` / `height`
--   - menu_likes (025) 참조 정합 — `menu_likes.menu_id text` 가 `cafe_menu_items.id`
--     를 참조. 본 마이그에서 FK 명시화 (`menu_id text references cafe_menu_items(id)`).
--
-- id 컬럼 결정:
--   현 데이터 id 패턴: 's01'~'s08' (signature) / 'b01'~'b04' (brewing) / 't01'~'t03' (tea)
--   / 'n01'~'n07' (non-coffee) / 'd01'~'d08' (dessert)
--   → 사람이 읽는 prefix + 번호 (admin UX 친화). UUID 대신 text PK 유지.
--   menu_likes (025) FK 정합 위해 text 그대로.
--
-- 의존:
--   - 001_profiles.sql (set_updated_at · prevent_id_change)
--   - 020_profiles_role_rbac.sql (`public.is_admin(uuid)`)
--   - 025_menu_likes.sql (`menu_likes.menu_id text`)
--
-- 후속 (S213/S214):
--   - S213 — types/cafeMenu.ts + lib/cafeMenuServer.ts + seed (메뉴 35종) + blur
--   - S214 — 8 의존 파일 cafeMenuServer 마이그 + /api/menu-likes 갱신 + 회귀
--
-- 참조:
--   - memory/project_release_blocker_sprint.md §S213
--   - docs/admin-implementation-plan.md Group F
--   - supabase/migrations/README.md (운영 워크플로우)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. cafe_menu_items 테이블 ──────────────────────────────────────────────
create table if not exists public.cafe_menu_items (
  -- text PK — menu_likes (025) FK 정합. 사람이 읽는 prefix + 번호.
  id              text primary key
    check (id ~ '^[a-z][0-9]{2,}$'),

  -- 메뉴명 ("황금오렌지커피" · "아메리카노")
  name            text not null,

  -- 카테고리 (데이터 고정) — UI 표시는 코드 매핑 (CAFE_CATEGORY_LABEL)
  cat             text not null
    check (cat in ('brewing', 'tea', 'non-coffee', 'dessert')),

  -- 카드 status 배지 — 빈 문자열 = 미표시
  -- ('시즌' / '시그니처' / 'NEW' / '인기' / '품절' / '시즌 한정' / '')
  status          text not null default ''
    check (status in ('시즌', '시그니처', 'NEW', '인기', '품절', '시즌 한정', '')),

  -- 온도 뱃지 — null = 디저트 등 온도 무관
  temp            text
    check (temp in ('ice-only', 'hot-only', 'warm', 'both') or temp is null),

  -- 추가 배지 (사용 안 하는 경우 빈 문자열)
  badge2          text not null default '',

  -- 가격 (KRW 정수)
  price           integer not null check (price >= 0),

  -- 짧은 설명 (현 데이터 모두 빈 문자열 — UI 미사용)
  description     text not null default '',

  -- 이미지 — public/ 유지 (DEC-5). 메뉴당 1장 정책
  img_src         varchar(256) not null,

  -- 카드 배경 hex
  bg              text not null,

  -- 영양 시트용 메뉴 설명 (멀티라인 OK)
  menu_desc       text not null default '',

  -- 영양 정보 (현 데이터 그대로 text 유지 — 단위 포함)
  vol             text not null default '',
  kcal            numeric(6, 1) not null default 0,
  satfat          text not null default '',
  sugar           text not null default '',
  sodium          text not null default '',
  protein         text not null default '',
  caffeine        text not null default '',
  allergen        text not null default '',

  -- LQIP blur (DEC-6) — build-time seed 시점에 채움
  blur_data_url   text,
  width           integer,
  height          integer,

  -- 목록 정렬 (낮을수록 앞)
  sort_order      integer not null default 0,

  -- 어드민 숨김 토글 (status='품절' 과 다름 — is_active=false 면 검색 미노출)
  is_active       boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 인덱스
create index if not exists cafe_menu_items_cat_idx
  on public.cafe_menu_items (cat)
  where is_active = true;

create index if not exists cafe_menu_items_status_idx
  on public.cafe_menu_items (status)
  where is_active = true and status <> '';

create index if not exists cafe_menu_items_sort_order_idx
  on public.cafe_menu_items (sort_order, created_at desc)
  where is_active = true;

-- 검색 인덱스 (Group F searchData 통합 시 활용)
-- pg_trgm extension 활성화 (046 에서 활성. 안전한 idempotent)
create extension if not exists pg_trgm;

create index if not exists cafe_menu_items_name_trgm_idx
  on public.cafe_menu_items using gin (name gin_trgm_ops);

create index if not exists cafe_menu_items_menu_desc_trgm_idx
  on public.cafe_menu_items using gin (menu_desc gin_trgm_ops);

-- 트리거
create trigger cafe_menu_items_set_updated_at
  before update on public.cafe_menu_items
  for each row execute function public.set_updated_at();

create trigger cafe_menu_items_prevent_id_change
  before update on public.cafe_menu_items
  for each row execute function public.prevent_id_change();

comment on table public.cafe_menu_items is
  '카페 메뉴 카탈로그 (signature · brewing · tea · non-coffee · dessert). lib/cafeMenu.ts 이관 (S213).';
comment on column public.cafe_menu_items.id is
  'text PK (prefix + 2자리 — ''s01'' / ''b01''). menu_likes.menu_id FK 정합.';
comment on column public.cafe_menu_items.status is
  '''시그니처''는 별도 카테고리 아닌 status 마커 (cat=brewing/non-coffee).';
comment on column public.cafe_menu_items.is_active is
  '어드민 숨김. false 면 검색·목록 노출 0 (status=품절 과 다름).';


-- ── 2. menu_likes (025) FK 정합 ────────────────────────────────────────────
-- 기존 025_menu_likes.sql 의 `menu_id text` 컬럼에 FK 추가.
-- 현재 menu_id 값들은 'b04' 'd08' 등으로 코드 상수 매칭. seed 적용 후 FK 적용.
-- → 본 마이그에 FK 추가 못 함 (seed 선행 필수). S213 seed 적용 후 별도 마이그
--   (예: 048_menu_likes_fk.sql) 로 FK 추가 권장.
-- comment 만 남김.
comment on column public.menu_likes.menu_id is
  '카페 메뉴 ID. S213 seed 적용 후 FK 추가 권장 (cafe_menu_items.id 참조).';


-- ── 3. RLS 정책 (SELECT public · write admin only) ─────────────────────────
alter table public.cafe_menu_items enable row level security;

create policy cafe_menu_items_select_public on public.cafe_menu_items
  for select
  using (is_active = true or public.is_admin(auth.uid()));

create policy cafe_menu_items_admin_all on public.cafe_menu_items
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


-- ── 4. seed 위치 안내 ──────────────────────────────────────────────────────
-- 메뉴 35종 (시그니처 8 + 브루잉 4 + 티 3 + 논커피 7 + 디저트 8 + 신규 5) seed 는
-- 본 마이그에 포함하지 않음.
-- S213 에서 별도 SQL 스크립트 또는 마이그로 처리:
--   - lib/cafeMenu.ts CAFE_MENU 배열 → INSERT
--   - scripts/generate-image-blur.mjs 확장 → blur_data_url / width / height
--   - menu_likes.menu_id FK 추가 (시점에 따라 별도 마이그)
