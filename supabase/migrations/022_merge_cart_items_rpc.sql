-- ═══════════════════════════════════════════════════════════════════════════
-- 022_merge_cart_items_rpc.sql — 게스트 카트 일괄 흡수 RPC (C-M3)
--
-- 배경:
--   Session 12 의 mergeGuestCart 는 서비스 레이어에서 N 개 아이템을 순차 upsert.
--   N 왕복 네트워크 → 최대 50 아이템 가정 시 지연 누적. 단일 트랜잭션 보장도 없음.
--
-- 해결:
--   유효성 검증된(PRODUCTS 카탈로그 lookup 완료) 아이템 배열을 단일 함수 호출로
--   원자 upsert. 019 의 partial unique 인덱스 규칙을 그대로 준수.
--
-- 보안:
--   - SECURITY INVOKER (RLS 적용). 호출자 = authenticated user.
--   - p_user_id 는 auth.uid() 와 일치해야 INSERT/UPDATE 허용 (RLS with_check).
--   - service_role 호출 시에는 RLS 우회되므로 cartService 는 user-context 클라이언트 사용.
--
-- 입력 형식 (p_items jsonb):
--   [{
--     product_slug, product_volume, quantity,
--     unit_price_snapshot, item_type, subscription_period
--   }, ...]
--
-- 참조:
--   - 019_cart_items.sql (partial unique index)
--   - next/src/lib/services/cartService.ts (호출자)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.merge_cart_items (
  p_user_id uuid,
  p_items jsonb
) returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_item          jsonb;
  v_item_type     public.order_item_type;
  v_period        public.subscription_period;
  v_existing_id   uuid;
  v_existing_qty  integer;
  v_merged        integer := 0;
  v_new_qty       integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return 0;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_type := (v_item ->> 'item_type')::public.order_item_type;
    v_period := nullif(v_item ->> 'subscription_period', '')::public.subscription_period;

    -- 동일 키 레코드 검색 (partial unique index 와 동일 조건)
    if v_item_type = 'subscription' then
      select id, quantity
        into v_existing_id, v_existing_qty
        from public.cart_items
       where user_id = p_user_id
         and product_slug = v_item ->> 'product_slug'
         and product_volume = v_item ->> 'product_volume'
         and item_type = 'subscription'
         and subscription_period = v_period
       limit 1;
    else
      select id, quantity
        into v_existing_id, v_existing_qty
        from public.cart_items
       where user_id = p_user_id
         and product_slug = v_item ->> 'product_slug'
         and product_volume = v_item ->> 'product_volume'
         and item_type = 'normal'
       limit 1;
    end if;

    if v_existing_id is not null then
      -- 수량 합산 (상한 99 — cart_items_quantity_range CHECK 와 일치)
      v_new_qty := least(99, v_existing_qty + (v_item ->> 'quantity')::integer);
      update public.cart_items
         set quantity = v_new_qty,
             unit_price_snapshot = (v_item ->> 'unit_price_snapshot')::integer
       where id = v_existing_id;
    else
      insert into public.cart_items (
        user_id,
        product_slug,
        product_volume,
        quantity,
        unit_price_snapshot,
        item_type,
        subscription_period
      ) values (
        p_user_id,
        v_item ->> 'product_slug',
        v_item ->> 'product_volume',
        (v_item ->> 'quantity')::integer,
        (v_item ->> 'unit_price_snapshot')::integer,
        v_item_type,
        v_period
      );
    end if;

    v_merged := v_merged + 1;
  end loop;

  return v_merged;
end;
$$;

comment on function public.merge_cart_items (uuid, jsonb) is
  '게스트 카트 일괄 흡수 — 단일 트랜잭션 bulk upsert (C-M3). SECURITY INVOKER + RLS 준수.';

-- 권한: 인증된 사용자만 호출. anon 차단.
revoke execute on function public.merge_cart_items (uuid, jsonb) from public, anon;
grant execute on function public.merge_cart_items (uuid, jsonb) to authenticated, service_role;
