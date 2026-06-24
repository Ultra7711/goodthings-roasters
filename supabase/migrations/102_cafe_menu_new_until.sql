-- ════════════════════════════════════════════════════════════════════════
-- 102_cafe_menu_new_until.sql — NEW 배지 자동 만료일 컬럼 추가 (S331)
--
-- 배경:
--   S330 에서 NEW 를 badge2('NEW'|'') 전용 마커로 분리. 자동 만료는 후속으로
--   미뤘고(수동 on/off), 본 마이그가 그 위에 자동 만료 타이머를 얹는다.
--
-- 동작:
--   new_until timestamptz null 추가.
--   - NULL          = 자동 만료 없음 (무기한 NEW · badge2='NEW' 인 동안 계속 표시)
--   - now() 이전 값 = 만료됨 (표시·상단정렬 제외. badge2='NEW' 는 보존 → 재설정 가능)
--   - now() 이후 값 = 그 일시까지 NEW 표시
--
-- 표시 규칙 (서버 fetch 시점 판정 · mapCafeMenuRow):
--   NEW 활성 = badge2='NEW' AND (new_until IS NULL OR new_until > now())
--   만료 시 badge2 를 '' 로 다운그레이드하여 정렬/배지 자동 일반 처리.
--   DB 의 badge2='NEW' 는 지우지 않음 (운영자가 만료일 재설정 시 부활 가능).
--
-- 참조: types/cafeMenu.ts (mapCafeMenuRow) · lib/cafeMenuServer.ts (cacheLife 60s)
--       app/admin/(authed)/menu/[id]/edit/MenuEditForm.tsx (자동 만료 UI)
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.cafe_menu_items
  add column if not exists new_until timestamptz;

comment on column public.cafe_menu_items.new_until is
  'NEW 배지 자동 만료 일시 (S331). NULL=무기한. badge2=''NEW'' 와 함께 판정: now()>new_until 이면 표시 제외(badge2 는 보존).';

commit;
