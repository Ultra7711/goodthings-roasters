-- ═══════════════════════════════════════════════════════════════════════════
-- 078_order_number_random.sql — order_number 채번을 sequence → 랜덤으로 전환
--
-- 배경 (S297):
--   order_number 는 orders INSERT(= 결제 시도 직전, status='pending') 시점에
--   채번된다. 토스 제약상 결제 시도마다 새 orderId 가 필요하고(재사용 불가),
--   order_number 가 곧 토스 orderId 이므로 수량 왕복·미결제 이탈마다 번호가 +1.
--   sequence 는 DELETE/롤백으로 되돌아가지 않아, 'GT-YYYYMMDD-000071' 의 일련
--   번호가 실제 paid 주문 수를 크게 과대 표시하고 매출 규모를 외부에 노출한다.
--
-- 변경 (트랙 A · docs/order-number-redesign-plan.md §7):
--   - set_order_number() 의 nextval(order_number_seq) → 6자리 랜덤 숫자.
--     기존 011 의 재시도 루프(최대 10회) + not exists 체크 + unique 예외 구조는
--     그대로 재사용 — 랜덤이 되면서 이 루프가 비로소 실질적 충돌 방어가 된다.
--   - 형식 'GT-YYYYMMDD-NNNNNN' (6자리) 유지 → CHECK orders_number_format
--     ('^GT-[0-9]{8}-[0-9]{5,6}$', 011) 및 앱 정규식 무변경. 코드 변경 0.
--   - order_number_seq 미사용화 → DROP.
--
-- 호환:
--   - 기존 paid 주문 번호(불변)는 그대로 정상. order_number 는 채번 후 immutable.
--   - 토스 orderId = order_number 유지 (랜덤도 6~64자·재사용 안 함).
--   - 주문 정렬은 created_at 인덱스 사용(M6) → 번호 비연속 무영향.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
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
    -- 6자리 랜덤 숫자 (000000~999999, 하루 1M 조합). 연속성 제거 →
    -- 주문 규모 과대 표시 및 매출 규모 노출 차단.
    v_candidate := v_date_prefix
      || lpad((floor(random() * 1000000))::integer::text, 6, '0');

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
  'S297: 주문번호 자동 채번 = 날짜 + 6자리 랜덤 + 중복 시 최대 10회 재추첨. '
  '연속 sequence 폐기(미결제 이탈·수량 왕복 시 번호 과대 표시/매출 규모 노출 차단).';

-- order_number_seq 미사용화 (set_order_number 가 유일 사용처였음) → 제거.
drop sequence if exists public.order_number_seq;
