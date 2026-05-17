-- ═══════════════════════════════════════════════════════════════════════════
-- 058_delete_site_settings_season.sql — 시즌 배너 row 삭제 (S234 폴리싱)
--
-- 배경:
--   - 시즌 배너는 B2C 사이트에서 렌더되지 않는 dead feature.
--     (.season key 또는 .season-banner class 를 소비하는 컴포넌트 0건)
--   - 시그니처 chapter 가 분기 갱신 역할 (2026 SS · SU · FW · WT) 을 흡수.
--   - 코드·CSS·이미지·헬퍼는 코드 commit 으로 모두 제거 완료.
--
-- 이 마이그:
--   - site_settings 테이블에서 key='season' row 삭제.
--   - season-banners 버킷은 시그니처/cafe-event 가 prefix 공유로 사용 중 → 유지.
--     (버킷 rename 은 별 sprint 로 carry-over)
--
-- Rollback:
--   - 시즌 배너 부활 시 032_site_settings.sql 의 seed 참고하여 row INSERT.
--     (단, 코드 차원에서 SeasonSettings schema 및 SettingsForm Section 3 복원 선행 필요)
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.site_settings where key = 'season';
