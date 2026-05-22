-- ═══════════════════════════════════════════════════════════════════════════
-- 069_site_settings_home_featured.sql — 메인 노출 카페 메뉴 슬롯 (S248)
--
-- 배경:
--   - 메인 페이지 §2.5 CafeMenuSection 의 시그니처 메뉴 3종 노출이 현재
--     `cafe_menus.status='시그니처' .slice(0, 3)` 자동 추출 로직.
--   - 운영자가 어떤 메뉴를 어느 순서로 노출할지 명시 통제 불가.
--   - 시그니처가 아닌 메뉴 (시즌·NEW·인기·status 마커 없는 메뉴) 도 노출 필요.
--
-- 변경:
--   - site_settings 에 key='home_featured' row 신설.
--   - value JSONB = { menu_ids: [uuid, uuid, uuid] } (길이 0~3 · 순서 = 노출 순서).
--   - 빈 배열·미설정 시 자동 fallback (DEC-S248-8) = 기존 status='시그니처' .slice(0,3).
--
-- 결정 박음 (S248):
--   - DEC-S248-3 site_settings 저장 (별 테이블 신설 X · 단일 책임).
--   - DEC-S248-4 Dropdown source = `cafe_menus` 전체 (is_active=true · status 무관).
--   - DEC-S248-5 `cafe_menus.status='시그니처'` 마커는 그대로 유지 (PDP/리스트 배지 + 정렬 가중).
--   - DEC-S248-6 `/menu` 페이지 정렬 영향 없음 (기존 status 정렬 유지).
--   - DEC-S248-7 메인 노출 메뉴 사용자 시각 — 기본 카드 그대로 (배지 추가 X).
--   - DEC-S248-8 0 slot fallback — 기존 `status='시그니처' .slice(0,3)` 자동 fallback.
--
-- payload schema (lib/siteSettings.ts HomeFeaturedSettingsSchema 와 1:1):
--   {
--     menu_ids: text[]  -- 길이 0~3 · 각 원소 = cafe_menus.id (text PK · 047 마이그
--                       --   check constraint `^[a-z][0-9]{2,}$` 패턴 — 'sig-001' 같은
--                       --   prefix + 2자리. uuid 아님)
--   }
--
-- Rollback:
--   - DELETE FROM site_settings WHERE key='home_featured';
--   - CafeMenuSection.tsx 의 fetch 분기 회귀 시 자동 fallback 으로 시그니처 .slice(0,3) 복원.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. home_featured row 신설 (빈 배열 = 자동 fallback) ─────────────────────
insert into public.site_settings (key, value)
values
  (
    'home_featured',
    jsonb_build_object('menu_ids', '[]'::jsonb)
  )
on conflict (key) do nothing;

-- ── 2. RLS 정책은 site_settings 의 기존 정책 재사용 ─────────────────────────
-- (admin write + public read · 032 마이그 답습)
