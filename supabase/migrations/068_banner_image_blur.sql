-- ═══════════════════════════════════════════════════════════════════════════
-- 068_banner_image_blur.sql — 어드민 업로드 배너 이미지 LQIP blur dataURL (S246)
--
-- 배경:
--   - cafe-event / signature 배너는 iframe srcDoc 모델 (060/061/062). 운영자
--     production HTML 의 <img> 가 Storage URL 을 가리킴.
--   - 정적 이미지 (products/cafe-menu) 는 빌드 타임 products-blur.json 등으로 LQIP
--     placeholder 처리. 어드민 업로드는 빌드 타임 생성 불가 → 별도 컬럼 필요.
--
-- 변경:
--   - cafe_events ADD: image_blur_desktop / tablet / mobile (text · base64 data URL)
--   - site_settings.signature payload schema 확장: image_blur_desktop / tablet / mobile
--
-- 운영자 HTML placeholder 규칙 확장 (061 + 062 답습):
--   {{IMAGE_BLUR_DESKTOP}} → 데스크탑 이미지 base64 LQIP data URL
--   {{IMAGE_BLUR_TABLET}}  → 태블릿 LQIP
--   {{IMAGE_BLUR_MOBILE}}  → 모바일 LQIP
--
-- 운영자 사용 패턴 (banner-conversion-guide.md):
--   <img src="{{IMAGE_DESKTOP}}"
--        style="background-image:url('{{IMAGE_BLUR_DESKTOP}}'); background-size:cover;">
--   image 로드 전 base64 LQIP 가 background-image 로 표시 → 로드 완료 시 자연 페이드.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. cafe_events — image_blur_* 3 cols ───────────────────────────────────
alter table public.cafe_events
  add column if not exists image_blur_desktop text not null default '',
  add column if not exists image_blur_tablet  text not null default '',
  add column if not exists image_blur_mobile  text not null default '';

comment on column public.cafe_events.image_blur_desktop is
  '데스크탑 이미지 LQIP base64 data URL (data:image/webp;base64,...). '
  'EventBanner 가 HTML 안 {{IMAGE_BLUR_DESKTOP}} placeholder 를 이 값으로 치환. '
  '업로드 시 server action 이 plaiceholder 로 생성 (S246).';
comment on column public.cafe_events.image_blur_tablet is
  '태블릿 LQIP. 비어있으면 desktop 값으로 fallback. {{IMAGE_BLUR_TABLET}} 치환.';
comment on column public.cafe_events.image_blur_mobile is
  '모바일 LQIP. 비어있으면 desktop 값으로 fallback. {{IMAGE_BLUR_MOBILE}} 치환.';

-- ── 2. site_settings.signature payload 확장 (image_blur_* 3 cols) ─────────
update public.site_settings
set value = value || jsonb_build_object(
  'image_blur_desktop', '',
  'image_blur_tablet',  '',
  'image_blur_mobile',  ''
)
where key = 'signature';
