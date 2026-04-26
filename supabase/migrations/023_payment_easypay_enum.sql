-- ═══════════════════════════════════════════════════════════════════════════
-- 023_payment_easypay_enum.sql — BUG-115 PR1 / 옵션 Z 확장 (1/2)
--
-- 목적:
--   PostgreSQL 의 `ALTER TYPE ... ADD VALUE` 는 동일 트랜잭션 내에서 새 값
--   사용이 제약되므로(version-by-version 차이), enum 변경만 단독 마이그레이션
--   으로 분리한다. 후속 024 가 추가된 enum 값을 컬럼/CHECK/RPC 에서 사용한다.
--
-- 변경 사항:
--   1) public.payment_method enum 에 'easypay' 추가
--   2) public.easypay_provider enum 신규 (토스 9종 provider)
--
-- 위험 요소:
--   - 기존 데이터 변경 없음. 추가만 발생하므로 데이터 손실 위험 0.
--   - 'easypay' 가 미사용 상태로 enum 에 존재해도 무관 (orders/payments 컬럼은
--     아직 추가되지 않았으므로 어느 행도 'easypay' 를 갖지 않는다).
--
-- 롤백:
--   PostgreSQL 은 `ALTER TYPE ... DROP VALUE` 를 지원하지 않는다.
--   롤백이 필요하면 enum 타입 재생성(전체 컬럼 마이그레이션) 필요 — 운영 정책상
--   ADD VALUE 는 사실상 단방향. 본 마이그레이션 적용 전에 환경 백업 권장.
--
-- 참조:
--   - docs/bug115-payment-easypay-design.md §2 (Toss ENUM) · §3.1 (enum 확장)
--   - 003_orders.sql (payment_method 원본 정의)
--   - https://docs.tosspayments.com/reference/enum-codes
-- ═══════════════════════════════════════════════════════════════════════════

-- ── (1) payment_method 확장 ──────────────────────────────────────────────
-- IF NOT EXISTS 로 멱등 적용. 재실행 시 noop.
alter type public.payment_method add value if not exists 'easypay';

comment on type public.payment_method is
  '결제 수단. card = 신용/체크카드, transfer = 계좌이체/가상계좌, easypay = 간편결제 (Toss 9종 provider).';


-- ── (2) easypay_provider 신규 enum ───────────────────────────────────────
-- Toss 응답 `easyPay.provider` 의 9종 (어드민 비활성 상태 포함, 미래 확장 친화).
-- 출처: https://docs.tosspayments.com/guides/v2/easypay-response
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'easypay_provider' and typnamespace = 'public'::regnamespace
  ) then
    create type public.easypay_provider as enum (
      'tosspay',     -- 토스페이 / 토스결제 (TOSSPAY)
      'kakaopay',    -- 카카오페이 (KAKAOPAY)
      'naverpay',    -- 네이버페이 (NAVERPAY)
      'payco',       -- 페이코 (PAYCO)
      'samsungpay',  -- 삼성페이 (SAMSUNGPAY)
      'lpay',        -- 엘페이 (LPAY)
      'ssgpay',      -- SSG페이 (SSG)
      'applepay',    -- 애플페이 (APPLEPAY)
      'pinpay'       -- 핀페이 (PINPAY)
    );
  end if;
end
$$;

comment on type public.easypay_provider is
  'Toss easyPay.provider 9종 매핑. payment_method = ''easypay'' 일 때 필수, 그 외 NULL. '
  '어드민 활성/비활성과 무관하게 enum 에 모두 등록 (미래 확장 대비).';
