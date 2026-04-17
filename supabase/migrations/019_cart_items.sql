-- ═══════════════════════════════════════════════════════════════════════════
-- 019_cart_items.sql — 회원 장바구니 테이블 + RLS (Session 12)
--
-- 배경:
--   카트를 이중 구조로 운영한다.
--   - 회원: 이 테이블 (기기 간 동기화 지원)
--   - 게스트: 브라우저 localStorage (기기 고정 — 설계 결정)
--
--   로그인 시 localStorage 항목을 DB 로 1회 merge (game-level merge RPC 는
--   cartRepo.mergeGuestCart 에서 UPSERT 루프로 처리).
--
-- 스키마 원칙:
--   - order_items 의 enum 재사용 (order_item_type, subscription_period) —
--     같은 상품·옵션이 장바구니 → 주문으로 단순 전이 가능하도록 형태 일치.
--   - 단가 스냅샷 (unit_price_snapshot) 저장 — 담은 시점 가격 보존. 결제 시
--     서버가 재계산 후 비교하여 가격 변동 사용자 안내. 쿠팡·29CM 방식.
--   - UNIQUE (user_id, product_slug, product_volume, item_type, subscription_period)
--     으로 같은 구성은 1행. 동일 아이템 재담기 시 quantity 합산 (repo 에서 UPSERT).
--
-- RLS:
--   - 4 정책 (select/insert/update/delete) — 모두 authenticated + auth.uid()=user_id.
--   - 게스트(anon) 전면 차단. service_role 은 merge/관리자 용도로 우회.
--   - 007 의 11 개 정책 패턴과 동일 (auth.uid() → (select auth.uid()) 래핑).
--
-- 참조:
--   - supabase/migrations/004_order_items.sql (enum 정의)
--   - supabase/migrations/007_rls_policies.sql (RLS 패턴)
--   - docs/backend-architecture-plan.md §RLS/RBAC
-- ═══════════════════════════════════════════════════════════════════════════

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- 상품 식별 (order_items 와 동일 컬럼명 — 전이 편의)
  product_slug text not null,
  product_volume text not null,

  -- 수량 (UX 상한: 상품당 대량 주문 방지)
  quantity integer not null,

  -- 담은 시점 가격 스냅샷 (원화, int). 결제 시 서버가 PRODUCTS 기준 재계산 후
  -- 차이 있으면 UI 에서 안내. 스냅샷은 reference 용이며 실결제에 직접 사용하지 않음.
  unit_price_snapshot integer not null,

  -- 정기배송 분기 (order_items 와 동일 enum)
  item_type public.order_item_type not null default 'normal',
  subscription_period public.subscription_period,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 제약
  constraint cart_items_quantity_range check (quantity between 1 and 99),
  constraint cart_items_price_positive check (unit_price_snapshot > 0),

  -- item_type 과 subscription_period 일관성 (order_items 와 동일 규칙)
  constraint cart_items_subscription_period check (
    (item_type = 'subscription' and subscription_period is not null)
    or
    (item_type = 'normal' and subscription_period is null)
  ),

  -- 동일 구성은 1행 (UPSERT 대상 키).
  -- subscription_period 는 NULL 허용이므로 NULL-distinct 기본 동작 주의:
  -- normal 아이템은 NULL 이 여러 개 허용되면 unique 위배가 아님. 이를 막기 위해
  -- 별도 partial unique index 두 개로 분리 (normal vs subscription).
  -- → 아래 인덱스 참조.
  constraint cart_items_unique_placeholder check (true)
);

-- 인덱스
create index cart_items_user_id_idx on public.cart_items (user_id);

-- UPSERT 대상 부분 유니크 인덱스 (NULL 처리 명시적 분리)
create unique index cart_items_uniq_normal_idx
  on public.cart_items (user_id, product_slug, product_volume)
  where item_type = 'normal';

create unique index cart_items_uniq_subscription_idx
  on public.cart_items (user_id, product_slug, product_volume, subscription_period)
  where item_type = 'subscription';

-- updated_at 자동 갱신 트리거 (다른 테이블과 동일 패턴)
create or replace function public.cart_items_set_updated_at()
  returns trigger
  language plpgsql
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cart_items_updated_at
  before update on public.cart_items
  for each row
  execute function public.cart_items_set_updated_at();

-- ═══ RLS ═══════════════════════════════════════════════════════════════

alter table public.cart_items enable row level security;
alter table public.cart_items force row level security;

create policy "cart_items_select_own"
  on public.cart_items for select
  to authenticated
  using ((select auth.uid ()) = user_id);

create policy "cart_items_insert_own"
  on public.cart_items for insert
  to authenticated
  with check ((select auth.uid ()) = user_id);

create policy "cart_items_update_own"
  on public.cart_items for update
  to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id);

create policy "cart_items_delete_own"
  on public.cart_items for delete
  to authenticated
  using ((select auth.uid ()) = user_id);

-- ═══ 코멘트 ════════════════════════════════════════════════════════════

comment on table public.cart_items is
  '회원 장바구니 (기기 간 동기화). 게스트는 localStorage 사용 — 로그인 시 mergeGuestCart 로 1회 흡수.';
comment on column public.cart_items.unit_price_snapshot is
  '담은 시점 단가 (원). 결제 시 서버 재계산 기준가와 비교해 가격 변동 안내 (업계 표준 — 쿠팡/29CM).';
comment on policy "cart_items_select_own" on public.cart_items is
  '본인 카트만 조회. 게스트(anon) 전면 차단.';
