-- ═══════════════════════════════════════════════════════════════════════════
-- 075_cafe_events_family_month_webp.sql — S-PND-4 Step 1+3
--
-- 목적:
--   5월 가정의 달 캠페인 이미지 PNG → WebP 변환 (2.13MB → 127KB · 94% 감소)
--   + LQIP base64 dataURL 박음 (EventBanner 가 HTML placeholder 치환에 사용).
--   035 seed 가 image_path .png 박혀 있고 image_blur_* 빈 상태 → UPDATE.
--
-- 변경:
--   - image_path: .png → .webp
--   - image_blur_desktop: '' → base64 dataURL (sharp + plaiceholder 생성)
--   - image_blur_tablet/mobile: '' 유지 (EventBanner 가 desktop 으로 fallback)
--
-- 파일 변경 (별도):
--   - next/public/images/cafe-events/family-month-2026-05.webp 추가 (sharp quality 85)
--   - .png 파일은 일정 기간 보존 (다음 sprint 에서 정리)
--
-- LQIP 생성:
--   npm run gen:image-blur → next/src/lib/cafe-events-blur.json 의 base64 박음.
--   업로드 후 admin reupload 시 server action 이 새 blur 생성 (동일 흐름).
--
-- 참조:
--   - 035_cafe_events.sql §6 Seed
--   - 068_banner_image_blur.sql (image_blur_* 컬럼 추가)
--   - next/scripts/generate-image-blur.mjs (cafe-events 처리)
-- ═══════════════════════════════════════════════════════════════════════════

update public.cafe_events
set
  image_path = '/images/cafe-events/family-month-2026-05.webp',
  image_blur_desktop = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABHElEQVR4nGO4cWjmy8trPt7a9PnGpo/XNyKjd1fWM1zbN+P6vmnvrq2HqICgj3Dpc9smXNg98emF5f/fnf5yd9unW1u+3NoCV8FwZlvP7cNzfzzd9//Hrf8/bv15euTL3W0I6VMbu78+2PP/3en0aPdvz079/3X7zY3dG+fWQFQwPDqx+PujA12FvtURJttW9N88vvbuwaVWikyntk35fGMTw+xij9o4M31hBg99vgMzslfUhi6ti+pJM5lV5NaT6crgIMBgIcZgLckQZS08O8eiIUi+I8GwI0ajyFNCh4GBwUueIdVBtMJbpMhFwISXQYuBoT5MqyvRtDZcw5iNgcGSl8FGmMGAiaE7UUOXgUGHgeH82rr1PfH6YDYAoyOqvXfSpXQAAAAASUVORK5CYII='
where image_path in (
  '/images/cafe-events/family-month-2026-05.png',
  '/images/cafe-events/family-month-2026-05.webp'
);
