-- ════════════════════════════════════════════════════════════════════════
-- 101_cafe_menu_new_to_badge2.sql — NEW 를 status 에서 badge2 로 분리 (S330)
--
-- 배경:
--   카페 메뉴 정렬을 'NEW→인기→시그니처→카테고리' 자동 정렬에서
--   '카테고리 순 + sort_order' 단일 정책으로 단순화. NEW·인기·시그니처는
--   정렬 무관 배지로만 표시. NEW 는 status 와 직교한 독립 마커가 되도록
--   badge2 (기존 미사용 컬럼) 를 'NEW' 전용으로 전환.
--
-- 동작:
--   1) 기존 status='NEW' 메뉴 → badge2='NEW', status='' 로 이관
--   2) status check constraint 에서 'NEW' 제거
--   3) badge2 비표준 값 정리 후 'NEW' | '' 전용 check 추가
--
-- 참조: lib/cafeMenu.ts (sortCafeMenu 단일화) · MenuCardBadges (NEW 우선 표시)
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1) status='NEW' → badge2='NEW' 이관
update public.cafe_menu_items
set badge2 = 'NEW',
    status = ''
where status = 'NEW';

-- 2) status check 재정의 — 'NEW' 제거
alter table public.cafe_menu_items
  drop constraint if exists cafe_menu_items_status_check;

alter table public.cafe_menu_items
  add constraint cafe_menu_items_status_check
  check (status in ('시즌', '시그니처', '인기', '품절', '시즌 한정', ''));

-- 3) badge2 = NEW 전용 마커로 고정
--    기존 비표준 값(렌더된 적 없는 dead 입력) 은 '' 로 정리 후 check 추가
update public.cafe_menu_items
set badge2 = ''
where badge2 not in ('', 'NEW');

alter table public.cafe_menu_items
  drop constraint if exists cafe_menu_items_badge2_check;

alter table public.cafe_menu_items
  add constraint cafe_menu_items_badge2_check
  check (badge2 in ('', 'NEW'));

commit;
