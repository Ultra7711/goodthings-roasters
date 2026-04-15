-- ═══════════════════════════════════════════════════════════════════════════
-- 005_subscriptions.sql — 정기배송 구독
--
-- 리뷰 Pass 1 신규 (H3 — 2026-04-16):
--   - UI (MyPage) 가 이미 Subscription 엔티티 전제.
--   - Phase 3 재마이그레이션 비용 > 지금 추가 비용.
--   - 자동 결제 집행은 Phase 3. 본 테이블은 "구독 계약" 만 관리.
--
-- 설계:
--   - 상품 스냅샷 보관 (상품 변경 무관하게 구독 유지)
--   - status: active/paused/cancelled/expired
--   - next_delivery_at: 다음 배송 예정 시각 (활성 구독 인덱스)
-- ═══════════════════════════════════════════════════════════════════════════

create type public.subscription_status as enum (
  'active',
  'paused',
  'cancelled',
  'expired'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid (),

  -- 주문과 동일 — 탈퇴 시 활성 구독 있으면 삭제 차단 (C3 정책 일관성)
  user_id uuid not null references auth.users (id) on delete restrict,

  -- 최초 주문 참조 (관리자 직접 등록 시 NULL 허용)
  initial_order_id uuid references public.orders (id) on delete set null,

  -- 상품 스냅샷
  product_slug text not null,
  product_name text not null,
  product_volume text,
  product_image_src text,

  -- 주기 — 004 에서 선언한 subscription_period enum 재사용
  cycle public.subscription_period not null,

  -- 배송 스케줄
  next_delivery_at timestamptz not null,
  last_delivery_at timestamptz,

  status public.subscription_status not null default 'active',

  -- 중단·해지
  paused_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 상태 일관성
  constraint subscriptions_cancelled_consistency check (
    (status = 'cancelled' and cancelled_at is not null)
    or
    (status <> 'cancelled' and cancelled_at is null)
  ),
  constraint subscriptions_paused_consistency check (
    (status = 'paused' and paused_at is not null)
    or
    (status <> 'paused' and paused_at is null)
  )
);

-- 인덱스
create index subscriptions_user_id_idx on public.subscriptions (user_id);
-- 배송 스케줄러용 — 활성 구독의 다음 배송일만
create index subscriptions_next_delivery_idx
  on public.subscriptions (next_delivery_at)
  where status = 'active';
create index subscriptions_status_idx on public.subscriptions (status);

-- 트리거
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger subscriptions_prevent_id_change
  before update on public.subscriptions
  for each row execute function public.prevent_id_change();

comment on table public.subscriptions is
  '정기배송 구독 계약. 자동 결제 집행은 Phase 3 (H3).';
comment on column public.subscriptions.next_delivery_at is
  '다음 배송 예정 시각. 배송 스케줄러 배치가 이 컬럼 기반으로 활성 구독 조회.';
