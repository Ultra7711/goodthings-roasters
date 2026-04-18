-- ═══════════════════════════════════════════════════════════════════════════
-- 011_orders_hardening.sql — P2-A Pass 1 리뷰 DB/H-1~H-3 반영
--
-- 목적:
--   P2-A-2 (주문 생성 엔드포인트) 리뷰에서 도출된 데이터·RLS 관련 HIGH 이슈 3건을
--   단일 마이그레이션으로 정리한다.
--
-- 이슈 매핑 (리뷰 로그):
--   DB/H-1 · set_order_number 충돌 — v_seq % 100000 이 하루 100,000 건을 넘으면
--           unique 위반. 재시도 루프 + modulo 1,000,000 확장으로 완화.
--   DB/H-2 · create_order 입력 검증 — p_items 가 array 가 아니거나 0/50 초과인
--           호출 경로(잘못된 서비스 리팩터링·사이드카 툴링)에서 부분 INSERT 가
--           남지 않도록 RPC 진입점에서 즉시 raise.
--   DB/H-3 · orders_insert_own RLS drop — 클라이언트가 create_order RPC 를 우회
--           하지 않도록 authenticated 직접 INSERT 경로 제거. 주문 생성은
--           service_role (RPC) 단일 경로로 통일.
--
-- 권한 원칙 (P2-A):
--   INSERT orders/order_items = service_role only (= create_order RPC 경유)
--   SELECT orders = authenticated 본인 또는 service_role (게스트 조회 API)
--
-- 관련 문서:
--   - docs/backend-architecture-plan.md §7.2
--   - 003_orders.sql (set_order_number 원본)
--   - 007_rls_policies.sql (orders_insert_own 원본)
--   - 010_create_order_rpc.sql (RPC 본체)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── DB/H-1: set_order_number 재시도 루프 + modulo 확장 ───────────────────
-- 기존: nextval % 100000 → 하루 100k 건 초과 시 wrap 하면서 unique 충돌
-- 신규: nextval % 1_000_000 (하루 1M 건 수용) + 최대 10회 재시도하며 기존 번호와
--       충돌 시 재추첨. INSERT 와 사이 race 는 sequence 단조 증가 덕분에
--       같은 트랜잭션 내에서는 발생 불가.
create or replace function public.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_seq          bigint;
  v_candidate    text;
  v_date_prefix  text;
  v_attempts     integer := 0;
  v_max_attempts integer := 10;
begin
  if new.order_number is not null then
    return new;
  end if;

  v_date_prefix := 'GT-'
    || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
    || '-';

  loop
    v_seq := nextval('public.order_number_seq');
    -- modulo 1,000,000 → 6자리 숫자 (하루 최대 1M 건). 기존 5자리 대비
    -- 안전마진을 10배 확보하되 번호 형식은 아래 CHECK 에서 재정의.
    v_candidate := v_date_prefix || lpad((v_seq % 1000000)::text, 6, '0');

    if not exists (
      select 1 from public.orders where order_number = v_candidate
    ) then
      new.order_number := v_candidate;
      return new;
    end if;

    v_attempts := v_attempts + 1;
    exit when v_attempts >= v_max_attempts;
  end loop;

  raise exception 'set_order_number: failed to allocate unique order_number after % attempts', v_max_attempts
    using errcode = 'unique_violation';
end;
$$;

comment on function public.set_order_number is
  'DB/H-1: 주문번호 자동 채번 + 중복 시 최대 10회 재시도. '
  'modulo 1,000,000 (6자리) 로 하루 최대 1M 건 허용.';

-- order_number 형식 체크 재정의 — 5자리 → 5 또는 6자리 허용 (기존 데이터 호환)
-- 운영 중 데이터가 있다면 DROP/ADD 순서가 안전.
alter table public.orders
  drop constraint if exists orders_number_format;

alter table public.orders
  add constraint orders_number_format
  check (order_number ~ '^GT-[0-9]{8}-[0-9]{5,6}$');

-- ── DB/H-2: create_order 입력 검증 ─────────────────────────────────────
-- p_items jsonb 는 서비스 레이어(zod) 에서 이미 검증되지만, RPC 는 "신뢰된
-- 입력" 을 가정하므로 방어 2 겹으로 진입점에서 타입·길이를 확인한다.
-- 잘못된 입력 시 orders INSERT 전 raise → 부분 INSERT 없음.
create or replace function public.create_order(
  p_user_id            uuid,
  p_guest_email        text,
  p_guest_pin_hash     text,
  p_contact_email      text,
  p_contact_phone      text,
  p_shipping_name      text,
  p_shipping_phone     text,
  p_shipping_zipcode   text,
  p_shipping_addr1     text,
  p_shipping_addr2     text,
  p_shipping_msg_code  text,
  p_shipping_msg_cust  text,
  p_payment_method     public.payment_method,
  p_bank_name          text,
  p_depositor_name     text,
  p_subtotal           integer,
  p_shipping_fee       integer,
  p_discount_amount    integer,
  p_total_amount       integer,
  p_terms_version      text,
  p_items              jsonb
)
returns table (
  id            uuid,
  order_number  text,
  total_amount  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id    uuid;
  v_order_no    text;
  v_item        jsonb;
  v_items_len   integer;
begin
  -- ── DB/H-2: 입력 검증 — items 타입·길이 ──────────────────────────
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'create_order: p_items must be a jsonb array (got %)', jsonb_typeof(p_items)
      using errcode = 'invalid_parameter_value';
  end if;

  v_items_len := jsonb_array_length(p_items);
  if v_items_len = 0 then
    raise exception 'create_order: p_items must contain at least 1 item'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_items_len > 50 then
    raise exception 'create_order: p_items must contain at most 50 items (got %)', v_items_len
      using errcode = 'invalid_parameter_value';
  end if;

  -- ── orders INSERT ────────────────────────────────────────────────
  insert into public.orders (
    user_id,
    guest_email,
    guest_lookup_pin_hash,
    contact_email,
    contact_phone,
    shipping_name,
    shipping_phone,
    shipping_zipcode,
    shipping_addr1,
    shipping_addr2,
    shipping_message_code,
    shipping_message_custom,
    payment_method,
    bank_name,
    depositor_name,
    subtotal,
    shipping_fee,
    discount_amount,
    total_amount,
    status,
    agreed_at,
    terms_version
  ) values (
    p_user_id,
    p_guest_email,
    p_guest_pin_hash,
    p_contact_email,
    p_contact_phone,
    p_shipping_name,
    p_shipping_phone,
    p_shipping_zipcode,
    p_shipping_addr1,
    nullif(p_shipping_addr2, ''),
    p_shipping_msg_code,
    p_shipping_msg_cust,
    p_payment_method,
    p_bank_name,
    p_depositor_name,
    p_subtotal,
    p_shipping_fee,
    p_discount_amount,
    p_total_amount,
    'pending',
    now(),
    p_terms_version
  )
  returning orders.id, orders.order_number
    into v_order_id, v_order_no;

  -- ── order_items INSERT (반복) ────────────────────────────────────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      product_slug,
      product_name,
      product_category,
      product_volume,
      product_image_src,
      product_image_bg,
      quantity,
      unit_price,
      original_unit_price,
      line_total,
      item_type,
      subscription_period
    ) values (
      v_order_id,
      v_item ->> 'product_slug',
      v_item ->> 'product_name',
      v_item ->> 'product_category',
      nullif(v_item ->> 'product_volume', ''),
      nullif(v_item ->> 'product_image_src', ''),
      nullif(v_item ->> 'product_image_bg', ''),
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unit_price')::integer,
      (v_item ->> 'original_unit_price')::integer,
      (v_item ->> 'line_total')::integer,
      (v_item ->> 'item_type')::public.order_item_type,
      nullif(v_item ->> 'subscription_period', '')::public.subscription_period
    );
  end loop;

  return query
    select v_order_id, v_order_no, p_total_amount;
end;
$$;

comment on function public.create_order is
  'DB/H-2: 주문 + 주문 아이템 원자 INSERT. p_items 타입·길이 진입 검증 포함.';

-- 권한 재부여 — signature 동일하므로 기존 grant/revoke 가 유지되지만
-- `create or replace` 후 명시적으로 다시 선언해 불변 상태를 보장.
revoke execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_order(
  uuid, text, text, text, text,
  text, text, text, text, text, text, text,
  public.payment_method, text, text,
  integer, integer, integer, integer,
  text, jsonb
) to service_role;

-- ── DB/H-3: orders_insert_own RLS 정책 제거 ────────────────────────────
-- 기존: authenticated 가 orders 를 직접 INSERT 가능 (C2 로 status=pending 제한).
-- 문제: create_order RPC 를 우회해 order_items 없는 빈 주문을 생성 가능.
--       가격·총액 필드 클라 주입 가능 (비록 스키마가 integer 로 제약하지만
--       음수/왜곡 값 등 최소 공격면 존재).
-- 해결: 모든 주문 생성은 service_role RPC (= create_order) 를 통해서만 수행.
--       직접 INSERT 차단.
drop policy if exists "orders_insert_own" on public.orders;

comment on table public.orders is
  'DB/H-3: INSERT 는 service_role (create_order RPC) 전용. '
  'authenticated 직접 INSERT 정책 제거 (2026-04-16 P2-A Pass 1).';

-- 게스트 조회 PIN 인덱스는 이미 003 에 존재하지만, Pass 1 에서 guest-lookup
-- 쿼리가 user_id IS NULL + contact_email 필터를 동시에 사용하므로 복합 인덱스
-- 1건 보강 (성능 HIGH 로는 올라오지 않았으나 같은 파일에서 정리).
create index if not exists orders_guest_lookup_idx
  on public.orders (contact_email)
  where user_id is null and guest_lookup_pin_hash is not null;

comment on index public.orders_guest_lookup_idx is
  'guest-lookup 엔드포인트의 user_id IS NULL + email 매칭 조회 가속.';
