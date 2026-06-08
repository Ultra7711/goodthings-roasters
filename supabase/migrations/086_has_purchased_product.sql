-- ═══════════════════════════════════════════════════════════════════════════
-- 086_has_purchased_product.sql — 상품 구매 여부 RPC (리뷰 작성 UI 게이팅)
--
-- 목적:
--   리뷰 작성 폼 사전 게이팅 — 상품 PDP 에서 "리뷰 작성" 버튼 노출 여부 판정.
--   RLS insert policy(085 reviews_insert_own)의 구매 EXISTS 와 동일 로직.
--   (RLS = DB 강제 / 본 RPC = UI 사전 표시. 둘은 역할 분리.)
--
-- auth.uid() = 호출자 세션. authenticated 만 grant (비로그인 호출 불가).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.has_purchased_product (p_product_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = auth.uid ()
      and oi.product_slug = p_product_slug
      and o.status in ('paid', 'shipping', 'delivered')
  );
$$;

grant execute on function public.has_purchased_product (text) to authenticated;

comment on function public.has_purchased_product (text) is
  '본인이 해당 상품을 구매(paid/shipping/delivered)했는지 — 리뷰 작성 UI 게이팅. 085 RLS insert EXISTS 와 동일 로직.';
