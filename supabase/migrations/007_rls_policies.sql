-- ═══════════════════════════════════════════════════════════════════════════
-- 007_rls_policies.sql — Row Level Security 정책
--
-- 리뷰 Pass 1 반영 (2026-04-16):
--   - C1: 모든 auth.uid() → (select auth.uid()) 래핑 (성능 — 행별 재평가 방지)
--   - C2: orders_insert_own WITH CHECK 에 status='pending' 강제
--   - H3: subscriptions RLS
--   - H4: payment_transactions RLS (service_role 전용, 클라 전면 차단)
--
-- 원칙:
--   - authenticated 역할: auth.uid() = user_id 만 접근
--   - anon 역할: 쓰기 전면 차단 (게스트 주문 = service_role)
--   - service_role: RLS 우회 (callback·웹훅·관리자 전용)
--
-- 관련 문서:
--   - docs/oauth-security-plan.md §P2-2
--   - Supabase RLS perf: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ profiles ══════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- 본인 프로필 조회
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid ()) = id);

-- 본인 프로필 수정 (id 변경은 prevent_id_change 트리거·정책 둘 다 차단)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid ()) = id)
  with check ((select auth.uid ()) = id);

-- INSERT: handle_new_user 트리거 (SECURITY DEFINER) 전용 — 정책 미선언 = deny
-- DELETE: auth.users cascade 전용

-- ═══ addresses ═════════════════════════════════════════════════════════

alter table public.addresses enable row level security;
alter table public.addresses force row level security;

create policy "addresses_select_own"
  on public.addresses for select
  to authenticated
  using ((select auth.uid ()) = user_id);

create policy "addresses_insert_own"
  on public.addresses for insert
  to authenticated
  with check ((select auth.uid ()) = user_id);

create policy "addresses_update_own"
  on public.addresses for update
  to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id);

create policy "addresses_delete_own"
  on public.addresses for delete
  to authenticated
  using ((select auth.uid ()) = user_id);

-- ═══ orders ════════════════════════════════════════════════════════════

alter table public.orders enable row level security;
alter table public.orders force row level security;

-- 본인 주문 조회 (회원)
-- 게스트 주문은 user_id IS NULL 이므로 매칭 불가 → 자연 차단.
-- 게스트 조회는 별도 API 엔드포인트 (service_role + guest_lookup_pin_hash 검증).
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using ((select auth.uid ()) = user_id);

-- C2: 본인 주문 생성 — status='pending' 만 허용.
-- paid/shipping 등 후속 상태는 service_role 전용 (결제 승인·배송 처리).
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (
    (select auth.uid ()) = user_id
    and guest_email is null
    and status = 'pending'
  );

-- UPDATE/DELETE 는 service_role 전용 (default-deny).

-- ═══ order_items ═══════════════════════════════════════════════════════

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

-- 본인 주문의 아이템만 조회
create policy "order_items_select_own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = (select auth.uid ())
    )
  );

-- INSERT/UPDATE/DELETE 는 service_role 전용 (주문 생성 API 에서만).

-- ═══ subscriptions ════════════════════════════════════════════════════

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid ()) = user_id);

-- 본인 구독 일시정지·해지 (status·paused_at·cancelled_at 등 수정).
-- user_id·product_slug 등 핵심 필드 변경 방지는 Phase 3 에서 컬럼별 트리거 추가.
create policy "subscriptions_update_own"
  on public.subscriptions for update
  to authenticated
  using ((select auth.uid ()) = user_id)
  with check ((select auth.uid ()) = user_id);

-- INSERT/DELETE 는 service_role 전용 (주문 시 생성, 관리자 삭제).

-- ═══ payment_transactions ═════════════════════════════════════════════

alter table public.payment_transactions enable row level security;
alter table public.payment_transactions force row level security;

-- H4: 정책 미선언 = 클라이언트(authenticated·anon) 전면 차단.
-- service_role 만 접근 가능 (토스 웹훅 핸들러, 어드민 조회).

comment on policy "orders_insert_own" on public.orders is
  'C2: 클라이언트는 status=pending 만 INSERT 가능. paid 이후는 service_role.';
comment on policy "subscriptions_select_own" on public.subscriptions is
  'H3: 본인 구독만 조회. 타인 구독 열람 차단.';
