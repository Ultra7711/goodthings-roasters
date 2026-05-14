-- ═══════════════════════════════════════════════════════════════════════════
-- 052_products_roast_desc.sql — products.roast_desc 컬럼 + RPC 갱신 (S231-4)
--
-- 목적:
--   PDP 의 ROASTING 영역 설명 문구를 운영자가 직접 작성 가능하게.
--   기존: ProductRoastStage.tsx 의 STAGE_DESCRIPTIONS 6 단계 하드코딩.
--   이후: products.roast_desc 가 채워져 있으면 그 텍스트 노출 · 빈 값 fallback.
--
-- 호환:
--   default '' 로 컬럼 추가 → 기존 6 상품 row 영향 0.
--   ProductRoastStage 가 `product.roastDesc || STAGE_DESCRIPTIONS[idx]` 답습.
--
-- RPC 갱신:
--   create_product 가 roast_desc 도 INSERT.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.products
  add column if not exists roast_desc text not null default '';

comment on column public.products.roast_desc is
  '운영자가 작성하는 ROASTING 단계 설명 문구. 빈 문자열 시 ProductRoastStage.tsx 의 STAGE_DESCRIPTIONS 하드코딩 답습 (S231-4).';

-- ── create_product RPC 갱신 (051 답습 + roast_desc 추가) ────────────────
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

  if exists (select 1 from public.products where slug = v_slug) then
    raise exception 'slug_conflict' using errcode = '23505';
  end if;

  select coalesce(max(sort_order), -1) + 1
    into v_next_sort
    from public.products
   where category = v_category;

  insert into public.products (
    slug, name, category, status, display_price, sort_order, color,
    subscription, popup, description, specs, flavor_desc, roast_stage,
    roast_desc,
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
    '',
    coalesce(p_input->>'flavor_desc', ''),
    p_input->>'roast_stage',
    coalesce(p_input->>'roast_desc', ''),
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

revoke execute on function public.create_product(jsonb) from public, anon, authenticated;
grant execute on function public.create_product(jsonb) to service_role;
