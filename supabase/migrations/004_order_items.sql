-- ═══════════════════════════════════════════════════════════════════════════
-- 004_order_items.sql — 주문 라인 아이템
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - M2: original_unit_price (할인 전 단가 스냅샷 — 프로모션 리포팅)
--   - M5: subscription_period enum 도입
--
-- 003 에서 분리 — order_items 전용 enum 이 존재하고 파일 경계 명확화.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.order_item_type as enum (
  'normal',
  'subscription'
);

-- M5: 정기배송 주기 enum — UI 에서 선택 가능한 값만 허용.
-- subscriptions 테이블에서도 동일 enum 재사용.
create type public.subscription_period as enum (
  '2주',
  '4주',
  '6주',
  '8주'
);

create table public.order_items (
  id uuid primary key default gen_random_uuid (),
  order_id uuid not null references public.orders (id) on delete cascade,

  -- 상품 스냅샷 (상품 테이블 변경 무관)
  product_slug text not null,
  product_name text not null,
  product_category text not null,
  product_volume text,             -- '200g', '1kg', '5개' 등
  product_image_src text,
  product_image_bg text,           -- 카드 배경 (#ECEAE6 등)

  -- 수량·가격
  quantity integer not null,
  unit_price integer not null,     -- 실제 결제 단가 (할인 적용 후)
  -- M2: 할인 전 정가 스냅샷
  original_unit_price integer not null,
  line_total integer not null,     -- quantity * unit_price

  -- 정기배송 분기
  item_type public.order_item_type not null default 'normal',
  -- M5: 003 에서 선언한 enum 재사용
  subscription_period public.subscription_period,

  created_at timestamptz not null default now(),

  -- 제약
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_price_positive check (unit_price > 0),
  constraint order_items_original_price_positive check (original_unit_price > 0),
  -- 실결제 단가는 정가 이하여야 함
  constraint order_items_unit_price_within_original check (
    unit_price <= original_unit_price
  ),
  constraint order_items_line_total_matches check (
    line_total = quantity * unit_price
  ),

  -- item_type 과 subscription_period 일관성
  constraint order_items_subscription_period check (
    (item_type = 'subscription' and subscription_period is not null)
    or
    (item_type = 'normal' and subscription_period is null)
  )
);

-- 인덱스
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_slug_idx on public.order_items (product_slug);

comment on table public.order_items is
  '주문 라인 아이템. 상품 스냅샷 + 할인 전·후 단가 (M2).';
comment on column public.order_items.original_unit_price is
  '할인 전 정가 (리포팅·환불 산정용 스냅샷).';
