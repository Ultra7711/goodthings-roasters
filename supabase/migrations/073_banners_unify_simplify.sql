-- ═══════════════════════════════════════════════════════════════════════════
-- 073_banners_unify_simplify.sql — banners 진짜 통합 (S273)
--
-- 마이그 번호 메모:
--   071 주석의 원래 plan = "073: cafe_events / site_settings.signature → banners INSERT".
--   실제로는 072 가 그 역할 (data 이전) 로 작성되어 073 슬롯이 비었음.
--   본 마이그가 그 빈 슬롯을 채움 (continuity 회복).
--
-- 배경:
--   - S270 ~ S272 = banners 통합 schema (071/072) + 어드민 2 페이지 분리.
--   - 운영 검증 결과 두 kind 모두 multi row + active 1 모델이 자연스러움
--     (시즌별 갈아끼움 · 메인 노출 1개 고정 · 화살표 reorder UI).
--   - 따라서 partial UNIQUE (signature 단일) + CHECK (cafe_event type 필수)
--     + type 컬럼 + cafe_event_type enum 전부 폐기.
--   - 동시에 운영자 식별용 internal_label text 신설.
--
-- 본 마이그 책임:
--   1) CHECK banners_cafe_event_type_required DROP
--   2) Partial UNIQUE banners_only_one_signature DROP
--   3) banners.type 컬럼 DROP
--   4) banners.internal_label text 컬럼 추가 (운영자 자유 식별 텍스트)
--   5) Legacy 테이블 cafe_events DROP (S271-A 에서 caller 0 확인 · banners 가 SoT)
--   6) Legacy enum cafe_event_type DROP
--
-- 본 마이그 비책임 (별 sprint · carry):
--   - Storage 버킷 'cafe-events' / 'season-banners' 비우기 + DROP
--     (실 파일 잔존 확인 + 사용자 confirm 필요)
--
-- 운영 모델 변경:
--   기존: cafe_event = multi row + start_date 최신 우선 + type priority
--         signature = single row (partial UNIQUE)
--   신규: 두 kind 모두 multi row + enabled + period(NULL=무제한) + sort_order ASC
--         → 화살표 reorder UI 의 1번 카드 = 메인 노출 배너 (직관 정합)
--
-- Data 처리:
--   - S273 결정: 기존 cafe_events.type ('campaign' / 'collab' 등) 값 폐기 허용
--     (운영자가 신규 batch 로 갈아끼움 전제).
--   - banners.type 컬럼만 DROP — banners 의 image/HTML/period 등 핵심 데이터 보존.
--
-- Rollback:
--   - banners.type 복원 = ALTER TABLE ... ADD COLUMN type cafe_event_type
--     (단 cafe_event_type enum 재생성 선행 필요)
--   - partial UNIQUE + CHECK 복원 = CREATE UNIQUE INDEX / ADD CONSTRAINT
--   - cafe_events 테이블 복원 = 035 + 후속 마이그 전체 재실행 (실제 비현실적)
--   - 즉 본 마이그는 forward-only 로 운영.
--
-- 참조:
--   - 035_cafe_events.sql                 (cafe_events 원본 + cafe_event_type)
--   - 071_banners_unified.sql             (banners 신설 + CHECK + partial UNIQUE)
--   - 072_banners_data_migration.sql      (data 이전)
--   - memory/project_session272_complete.md (S272-N 사용자 시그널)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. CHECK constraint DROP ────────────────────────────────────────────
alter table public.banners
  drop constraint if exists banners_cafe_event_type_required;

-- ── 2. Partial UNIQUE INDEX DROP ────────────────────────────────────────
drop index if exists public.banners_only_one_signature;

-- ── 3. banners.type 컬럼 DROP ───────────────────────────────────────────
-- cafe_event_type enum 참조 제거 (다음 단계에서 enum DROP 가능).
alter table public.banners
  drop column if exists type;

-- ── 4. banners.internal_label 컬럼 추가 ─────────────────────────────────
-- 운영자 자유 식별 텍스트 (예: '봄 시즌 콜라보 2026' · '가정의 달 캠페인').
-- DB 노출 안 함 — 어드민 list 에서 카드 식별용. NULL/빈 문자열 허용.
alter table public.banners
  add column if not exists internal_label text not null default '';

comment on column public.banners.internal_label is
  '운영자 자유 식별 텍스트 (어드민 list 카드 라벨). '
  '예: "봄 시즌 콜라보 2026" · "가정의 달 캠페인". 사이트 노출 없음.';

-- ── 5. Legacy 테이블 cafe_events DROP ───────────────────────────────────
-- S271-A 에서 caller 0 확인 (cafeEvents.ts 모듈 폐기 · banners 가 SoT).
-- 072 에서 data 가 banners 로 이전 완료. 본 row 들은 banners 에 보존.
drop table if exists public.cafe_events cascade;

-- ── 6. Legacy enum cafe_event_type DROP ─────────────────────────────────
-- 5번에서 cafe_events 테이블이 DROP 되고 3번에서 banners.type 이 DROP 됐으므로
-- 본 enum 을 참조하는 곳이 더 이상 없음.
drop type if exists public.cafe_event_type;

-- ── 7. 검증 코멘트 ───────────────────────────────────────────────────────
-- 마이그 적용 후 검증:
--
--   -- banners.type 컬럼 부재
--   select column_name from information_schema.columns
--   where table_name = 'banners' and column_name = 'type';
--   -- expected: 0 rows
--
--   -- banners.internal_label 컬럼 존재
--   select column_name from information_schema.columns
--   where table_name = 'banners' and column_name = 'internal_label';
--   -- expected: 1 row
--
--   -- cafe_events 테이블 부재
--   select to_regclass('public.cafe_events');
--   -- expected: NULL
--
--   -- cafe_event_type enum 부재
--   select 1 from pg_type where typname = 'cafe_event_type';
--   -- expected: 0 rows
--
--   -- partial UNIQUE / CHECK 부재
--   select indexname from pg_indexes
--   where tablename = 'banners' and indexname = 'banners_only_one_signature';
--   -- expected: 0 rows
--
--   select conname from pg_constraint
--   where conname = 'banners_cafe_event_type_required';
--   -- expected: 0 rows
--
--   -- 기존 row 보존 확인
--   select kind, count(*) from public.banners group by kind;
--   -- expected: 071/072 이후 row count 유지 (감소 없음)
