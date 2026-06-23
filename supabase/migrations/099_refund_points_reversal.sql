-- ═══════════════════════════════════════════════════════════════════════════
-- 099_refund_points_reversal.sql — 환불 시 사용 포인트 비례 복원 (Phase 3 · DEC-S326-1)
--
-- 목적 (docs/points-implementation-plan.md §3 T6·§4·§10 P3):
--   결제 환불(Toss webhook refund_completed) 시 그 주문에서 사용했던 포인트
--   (orders.points_used)를 'reversed'(+N) 로 자동 복원한다. 어드민 수동 개입 0.
--
-- 복원 모델 — 현금 환불 비율과 동일 비율로 포인트 복원(DEC-S326-1):
--     누적복원목표 = floor( points_used × 누적환불현금 / 승인현금 )
--     이번복원     = 누적복원목표 − 기복원(refund 복원분 합)
--   - 전액환불(누적환불 = 승인현금) → 목표 = points_used 전액(잔여 정확 복원).
--   - 부분환불 다회 → 비율 누적·floor 오차는 다음 환불/전액 도달 시 흡수.
--   - 어드민은 Toss 콘솔에서 "환불할 현금"만 결정 → 시스템이 같은 비율로 포인트
--     자동 복원. 어드민은 포인트를 신경 쓸 필요 없음(관리 리스크 0).
--
-- 무결성 보장(직독 근거):
--   - 012 payments CHECK(refunded_amount <= approved_amount) → 누적환불 ≤ 승인현금
--     → floor(P×R/A) ≤ P (과복원 수학적 불가). least() 로 이중 방어.
--   - 012 approved_amount CHECK(>0) + payments found 확인 → 0 나눗셈 불가(방어 guard 유지).
--   - 멱등: webhook 자체가 payment_transactions.idempotency_key UNIQUE(021 234행)로
--     replay 시 23505 → 전체 롤백 → 복원 미실행. reverse_points 의 'refundrestore:'||
--     p_idempotency_key on conflict 가 2차 안전망.
--   - 기복원 SUM 은 'refundrestore:' 접두만 집계(starts_with) → pending 복원('restore:'·097)
--     이중계산 차단. (paid+환불 주문은 pending-cancel 경로를 탄 적 없어 상태머신상으로도
--     mutually exclusive · 접두 필터는 provable 안전을 위한 이중 방어.)
--   - 게스트(user_id null)·points_used=0 → 자연 skip. 탈퇴 익명화(015 set null) 주문도 skip.
--
-- 적립분(earned) 회수: DEC-P1(배송완료 후 적립)로 환불 대부분 미적립 → P3 범위 외.
--   배송완료 후 환불(드묾)의 적립 회수는 P4 어드민 adjust 로 처리(여기서 미관여).
--
-- 베이스: 021_session8_13_review_hardening.sql 의 apply_webhook_event(CRIT-2).
--   본체를 verbatim 보존하고 refund_completed 분기에 복원 블록만 추가(create or replace·
--   시그니처 불변 → 앱 paymentRepo.applyWebhookEventRpc 5인자 무변경).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.apply_webhook_event(
  p_order_id          uuid,
  p_event_type        public.payment_event_type,
  p_amount            integer,
  p_raw               jsonb,
  p_idempotency_key   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current          public.order_status;
  v_payment_row      public.payments%rowtype;
  v_next_refunded    integer;
  -- [P3] 사용 포인트 비례 복원용
  v_user_id          uuid;
  v_points_used      integer;
  v_target           bigint;
  v_already          bigint;
  v_restore          integer;
  v_reversing_id     uuid;
begin
  -- [C-1] 1단계: orders FOR UPDATE 를 가장 먼저 획득한다.
  select o.status into v_current
    from public.orders o
    where o.id = p_order_id
    for update;

  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;

  -- [C-1] 2단계: idempotency UNIQUE 삽입. 중복이면 23505 → 호출자가 catch 해 skip.
  insert into public.payment_transactions (
    order_id, event_type, amount, raw_payload, idempotency_key
  )
  values (
    p_order_id, p_event_type, p_amount, p_raw, p_idempotency_key
  );

  -- 이벤트 → 상태 전이. trigger 가 최종 방어.
  case p_event_type
    when 'payment_approved' then
      if v_current = 'pending' then
        -- [C-2] payments 행 선제 잠금.
        select * into v_payment_row
          from public.payments
          where order_id = p_order_id
          for update;

        -- [CRIT-2] payments 행 부재 시 status 업데이트 + 반환 (idempotency 보존).
        --          앱 레이어(webhookService)가 503 으로 선차단 중이나 RPC 경로 방어.
        if not found then
          update public.payment_transactions
            set status = 'skipped_missing_payment'
            where idempotency_key = p_idempotency_key;
          return;
        end if;

        update public.orders   set status = 'paid',     updated_at = now() where id = p_order_id;
        update public.payments set status = 'approved', updated_at = now() where order_id = p_order_id;
      else
        -- pending 이 아닌 상태에서 approved 이벤트는 멱등 skip 으로 기록.
        update public.payment_transactions
          set status = 'skipped_state_mismatch'
          where idempotency_key = p_idempotency_key;
      end if;

    when 'payment_cancelled' then
      if v_current = 'pending' then
        update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
        update public.payments
          set status = 'cancelled', updated_at = now()
          where order_id = p_order_id;
      else
        update public.payment_transactions
          set status = 'skipped_state_mismatch'
          where idempotency_key = p_idempotency_key;
      end if;

    when 'refund_completed' then
      select * into v_payment_row
        from public.payments
        where order_id = p_order_id
        for update;

      -- [CRIT-2] payments 부재 시 status 업데이트 + 반환 (idempotency 보존).
      if not found then
        update public.payment_transactions
          set status = 'skipped_missing_payment'
          where idempotency_key = p_idempotency_key;
        return;
      end if;

      v_next_refunded := v_payment_row.refunded_amount + abs(p_amount);

      update public.payments
        set refunded_amount = v_next_refunded,
            status = case
              when v_next_refunded >= v_payment_row.approved_amount then 'refunded'
              else 'partial_refunded'
            end,
            updated_at = now()
        where order_id = p_order_id;

      if v_next_refunded >= v_payment_row.approved_amount then
        if v_current in ('paid', 'refund_processing') then
          update public.orders set status = 'refunded', updated_at = now() where id = p_order_id;
        end if;
      end if;

      -- ── [P3] 사용 포인트 비례 복원 (DEC-S326-1) ──────────────────────────
      -- 같은 주문에서 동일 트랜잭션(상위 orders FOR UPDATE)으로 잠긴 행을 읽는다.
      select o.user_id, o.points_used
        into v_user_id, v_points_used
        from public.orders o
        where o.id = p_order_id;

      if v_user_id is not null and coalesce(v_points_used, 0) > 0 then
        -- 누적 복원 목표 = 사용포인트 × (누적환불현금 / 승인현금). bigint 곱(오버플로 방지).
        if coalesce(v_payment_row.approved_amount, 0) <= 0 then
          v_target := v_points_used;  -- ₩0 주문 방어(approved>0 CHECK 로 도달 불가)
        else
          v_target := least(
            v_points_used::bigint,
            (v_points_used::bigint * v_next_refunded) / v_payment_row.approved_amount
          );
        end if;

        -- 이미 복원한 refund 복원분(부분환불 다회 누적). pending 복원('restore:')은 제외.
        select coalesce(sum(amount), 0)
          into v_already
          from public.point_ledger
          where order_id = p_order_id
            and event_type = 'reversed'
            and starts_with(idempotency_key, 'refundrestore:');

        v_restore := (v_target - v_already)::integer;

        if v_restore > 0 then
          -- 원본 used 행 참조(감사 추적 · 094 reverse_points p_reversing_id).
          select id
            into v_reversing_id
            from public.point_ledger
            where order_id = p_order_id
              and event_type = 'used'
            order by created_at
            limit 1;

          perform public.reverse_points(
            v_user_id,
            v_restore,
            p_order_id,
            'refundrestore:' || p_idempotency_key,
            v_reversing_id,
            'refund_points_restored (' || v_restore || '/' || v_points_used || ')'
          );
        end if;
      end if;

    else
      null;  -- webhook_received 등은 로그만 남김
  end case;
end;
$$;

comment on function public.apply_webhook_event is
  '§4.4: Toss 웹훅 이벤트 반영. idempotency_key UNIQUE 로 중복 차단. '
  '[CRIT-2] payments 부재 시 raise 대신 payment_transactions.status 업데이트 후 return. '
  '[P3·S326] refund_completed 시 사용 포인트 비례 복원(reversed·멱등 refundrestore:||idem). '
  'service_role 전용.';

-- 권한 재확인 (create or replace 는 grant 보존하나 idempotent 재선언 · 5인자 시그니처)
revoke execute on function public.apply_webhook_event(
  uuid, public.payment_event_type, integer, jsonb, text
) from public, anon, authenticated;

grant execute on function public.apply_webhook_event(
  uuid, public.payment_event_type, integer, jsonb, text
) to service_role;
