-- ═══════════════════════════════════════════════════════════════════════════
-- 051_create_product_rpc.sql — create_product RPC function (S231-4)
--
-- 목적:
--   /admin/products/new 에서 신규 상품 등록 시 products + volumes + recipes
--   INSERT 를 단일 트랜잭션으로 보장. 중간 실패 시 자동 롤백 — orphan products
--   row 위험 0.
--
-- 이전 (S231-2): JS createProductAction 이 3 단계 INSERT 직접 호출.
--   중간 실패 시 products row 만 남음.
--
-- 처리:
--   1) slug UNIQUE 체크 (RAISE EXCEPTION SQLSTATE 23505)
--   2) sort_order = 같은 category max + 1 RPC 내부 재계산 (race 완화)
--   3) INSERT products (is_active=false — 안전장치 답습)
--   4) INSERT product_volumes (sort_order = idx)
--   5) INSERT product_recipes (coffee_bean 만 · sort_order = idx)
--   6) 반환: 새 slug
--
-- 권한:
--   - security definer (RPC 안에서 admin 권한으로 실행)
--   - revoke from anon/authenticated — service_role 만 호출 가능
--   - JS 측 createProductAction 에서 getAdminClaims 가드 후 admin client 로 호출
--
-- 입력 spec (jsonb):
--   {
--     slug, name, category, status, display_price, color, subscription, popup,
--     description, flavor_desc, roast_stage,
--     note_tags, note_tags_en, note_color,
--     note_sweet, note_body, note_aftertaste, note_aroma, note_acidity,
--     volumes: [{ label, price, sold_out }, ...],
--     recipes: [{ method, dose, temp, time, water }, ...]
--   }
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.create_product(
  p_input jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_slug        text;
  v_category    text;
  v_next_sort   integer;
  v_volume      jsonb;
  v_recipe      jsonb;
  v_idx         integer;
begin
  v_slug := p_input->>'slug';
  v_category := p_input->>'category';

  -- 1. slug UNIQUE 사전 체크 (INSERT 시 UNIQUE 제약도 보강하지만 깔끔한 에러)
  if exists (select 1 from public.products where slug = v_slug) then
    raise exception 'slug_conflict' using errcode = '23505';
  end if;

  -- 2. sort_order = 같은 category max + 1. 빈 카테고리 = 0.
  select coalesce(max(sort_order), -1) + 1
    into v_next_sort
    from public.products
   where category = v_category;

  -- 3. INSERT products (is_active=false 안전장치 답습)
  insert into public.products (
    slug, name, category, status, display_price, sort_order, color,
    subscription, popup, description, specs, flavor_desc, roast_stage,
    note_tags, note_tags_en, note_color,
    note_sweet, note_body, note_aftertaste, note_aroma, note_acidity,
    is_active
  ) values (
    v_slug,
    p_input->>'name',
    v_category,
    nullif(p_input->>'status', ''),
    p_input->>'display_price',
    v_next_sort,
    p_input->>'color',
    (p_input->>'subscription')::boolean,
    (p_input->>'popup')::boolean,
    coalesce(p_input->>'description', ''),
    '',  -- specs 빈 (UI 미노출 · 추후 확장)
    coalesce(p_input->>'flavor_desc', ''),
    p_input->>'roast_stage',
    coalesce(p_input->>'note_tags', ''),
    coalesce(p_input->>'note_tags_en', ''),
    coalesce(p_input->>'note_color', '#A47146'),
    (p_input->>'note_sweet')::numeric,
    (p_input->>'note_body')::numeric,
    (p_input->>'note_aftertaste')::numeric,
    (p_input->>'note_aroma')::numeric,
    (p_input->>'note_acidity')::numeric,
    false
  )
  returning id into v_id;

  -- 4. INSERT product_volumes (sort_order = idx)
  v_idx := 0;
  for v_volume in select * from jsonb_array_elements(p_input->'volumes')
  loop
    insert into public.product_volumes (
      product_id, label, price, sold_out, sort_order
    ) values (
      v_id,
      v_volume->>'label',
      (v_volume->>'price')::integer,
      (v_volume->>'sold_out')::boolean,
      v_idx
    );
    v_idx := v_idx + 1;
  end loop;

  -- 5. INSERT product_recipes (coffee_bean 만)
  if v_category = 'coffee_bean' then
    v_idx := 0;
    for v_recipe in select * from jsonb_array_elements(coalesce(p_input->'recipes', '[]'::jsonb))
    loop
      insert into public.product_recipes (
        product_id, method, dose, temp, time, water, sort_order
      ) values (
        v_id,
        v_recipe->>'method',
        v_recipe->>'dose',
        v_recipe->>'temp',
        v_recipe->>'time',
        v_recipe->>'water',
        v_idx
      );
      v_idx := v_idx + 1;
    end loop;
  end if;

  return v_slug;
end;
$$;

comment on function public.create_product(jsonb) is
  '신규 상품 등록 — products + volumes + recipes 단일 트랜잭션 INSERT (S231-4). slug 중복 시 SQLSTATE 23505. sort_order 카테고리 내부 max+1 재계산. is_active=false 안전장치 답습.';

revoke execute on function public.create_product(jsonb) from public, anon, authenticated;
