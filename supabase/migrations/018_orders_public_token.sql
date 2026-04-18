-- ═══════════════════════════════════════════════════════════════════════════
-- 018_orders_public_token.sql — 공개 식별자 (public_token) 추가
--
-- 목적 (Session 8 보안 #3, docs/payments-security-hardening.md §4):
--   order_number 는 `GT-YYYYMMDD-NNNNN` 형식의 순차 식별자 — 경쟁사가
--   매일 한 번 게스트 주문을 시도해 증가량을 관찰하면 일간 주문량 추정이
--   가능하다. 또한 이메일/URL 에 노출 시 이웃 주문번호 enumeration 브루트포스
--   표면이 된다.
--
--   UUID v4 (122 bits entropy) 을 고객 대면 식별자로 부여하여 열거 공격을
--   무력화한다. 내부/어드민은 기존 order_number 를 그대로 사용한다.
--   (업계 표준: Stripe pi_xxx, Toss tviva_xxx)
--
-- 변경 사항:
--   - orders.public_token uuid NOT NULL DEFAULT gen_random_uuid().
--   - UNIQUE 제약 (index) — enumeration 시 충돌 검증 가능.
--   - 기존 row 는 DEFAULT 로 자동 백필 (NOT NULL 이므로 즉시 생성).
--
-- 롤아웃 (스펙 §4.4):
--   - 4a (이 마이그레이션): 컬럼 추가 + 이메일/응답 body 에 token 병기.
--         `?orderNumber=` 경로는 호환성 유지.
--   - 4b (후속): production 에서 `?orderNumber=` 접근 차단. dev/staging 유지.
--
-- 롤백:
--   alter table public.orders drop column public_token;
--   (인덱스는 DROP COLUMN 시 자동 삭제)
-- ═══════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() 가 속한 pgcrypto 는 supabase 프로젝트 기본 설치됨.
-- 혹시 미설치면 아래 줄 주석 해제:
-- create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists public_token uuid not null default gen_random_uuid();

-- UNIQUE 인덱스 — 이론적 UUID 충돌(2^122 분의 1) 방어 + lookup O(log n).
create unique index if not exists orders_public_token_idx
  on public.orders (public_token);

-- 컬럼 코멘트 — 스키마 introspection 시 용도 식별.
comment on column public.orders.public_token is
  'Customer-facing opaque identifier (UUID v4). Used in URLs and email links instead of order_number to prevent enumeration of daily order volume. Internal/admin flows still use order_number. See docs/payments-security-hardening.md §4.';
