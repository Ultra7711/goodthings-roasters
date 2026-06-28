-- ═══════════════════════════════════════════════════════════════════════════
-- 110_cleanup_orphan_billing_methods.sql — orphan 빌링키 자동 정리 (S341 · B)
--
-- 배경:
--   결제수단 = 구독별 빌링키 종속(DEC-S336-PAY1). 재등록(R-3d/108)은
--   subscriptions.billing_method_id 만 교체하고 옛 billing_method row 는 남긴다.
--   또 빌링키 발급(issueBillingMethod)과 첫 결제(chargeFirstCycle)는 별도 2스텝
--   (/billing/success: authorizations → charge)이라, 발급 성공 후 첫 결제 거절·이탈 시
--   "구독에 한 번도 안 붙은" billing_method 가 남는다. 둘 다 orphan 으로 누적된다.
--
-- orphan 단일 정의:
--   deleted_at IS NULL 인데 어떤 active/paused 구독도 가리키지 않는 billing_method.
--   (타입1=교체 버림 · 타입2=발급 후 미연결 모두 이 정의로 통합)
--
-- 동시성 안전 (핵심):
--   진행 중인 첫 결제의 카드도 일시적으로 "미연결"이다. 이를 지우면
--   process_billing_charge_success 의 billing_method 검증(deleted_at IS NULL·042)이
--   실패해 "토스 출금 성공 후 구독 미생성" 사고가 난다. → registered_at 가 1시간 이상
--   지난 카드만 정리 대상(grace period). 결제 흐름은 분 단위라 진행 중 카드를 보호한다.
--
-- 호출:
--   - chargeFirstCycle 성공 후 (billingService) — 타입2 정리
--   - reattach-billing route 성공 후 (billingService.cleanupOrphanBillingMethods)
--     — 타입1 정리
--   둘 다 결제/재등록 성공 확정 후 fire-and-forget(실패 무시) — 핵심 RPC 무수정.
--
-- 보호 조건(전부 충족 시에만 soft delete):
--   id <> p_keep_id            방금 성공한 카드 보호(멱등)
--   registered_at < now()-1h   진행 중 결제 카드 보호(동시성)
--   NOT EXISTS active/paused    공유 구독 보호 + 미연결만(cancelled/expired 는 청구 없음)
--
-- 잔여(수용): "가입 시도→첫 결제 거절→포기(구독 0)" user 의 orphan 은 이후 트리거가
--   오지 않아 잔존. 빈도 극소·보안 위협 0(미연결=자동결제 미사용). 향후 cron 배치로
--   일괄 정리(Vercel Pro cron 여유 후). ADR-008 §0 기록.
--
-- 토스 측: 토스 v2 는 빌링키 삭제 API 없음 → DB soft delete 만(공식 권장 방치).
--
-- 의존: 040(billing_methods·registered_at·deleted_at·subscriptions.billing_method_id)
-- 참조: docs/adr/ADR-008 §0 (DEC-S341) · docs/launch-checklist.md T0
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.cleanup_orphan_billing_methods(
  p_user_id uuid,
  p_keep_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  update public.billing_methods bm
     set deleted_at = now()
   where bm.user_id = p_user_id
     and bm.deleted_at is null
     and bm.id <> p_keep_id
     -- 진행 중인 결제의 방금-발급 카드 보호 (동시성). 결제 흐름=분 단위.
     and bm.registered_at < now() - interval '1 hour'
     -- 활성/정지 구독이 가리키면 사용 중 → 보존(공유 구독 포함).
     and not exists (
       select 1
         from public.subscriptions s
        where s.billing_method_id = bm.id
          and s.status in ('active', 'paused')
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.cleanup_orphan_billing_methods(uuid, uuid) is
  'S341(B): orphan 빌링키 soft delete. 어떤 active/paused 구독도 안 가리키고 '
  '1시간 이상 지난(진행 중 결제 보호) billing_method 정리. p_keep_id=방금 성공 카드 보호. '
  'chargeFirstCycle·reattach 성공 후 fire-and-forget 호출. 토스 빌링키 삭제 API 없음→DB soft delete만.';

revoke execute on function public.cleanup_orphan_billing_methods(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.cleanup_orphan_billing_methods(uuid, uuid)
  to service_role;
