-- ═══════════════════════════════════════════════════════════════════════════
-- 061_cafe_events_image_placeholders.sql — image_path_* 3 cols 복원 (S234 후속)
--
-- 배경:
--   - 060 모델 = HTML 1 파일만 업로드. 운영자가 HTML 안 img src 를 절대
--     Storage URL 로 수동 교체해야 함 (UX 부담).
--   - 자동화: 어드민에서 이미지 3종 (desktop/tablet/mobile) 업로드 →
--     EventBanner 가 runtime 에 HTML fetch → {{IMAGE_DESKTOP}} 같은
--     placeholder 를 Storage URL 로 치환 → <iframe srcDoc> 임베드.
--
-- 변경:
--   - ADD: image_path_desktop / image_path_tablet / image_path_mobile (text)
--   - custom_html_path · aspect_* · image_alt 유지 (060)
--
-- HTML placeholder 규칙 (운영자 가이드):
--   {{IMAGE_DESKTOP}}  → 데스크탑 이미지 Storage URL
--   {{IMAGE_TABLET}}   → 태블릿 이미지 Storage URL
--   {{IMAGE_MOBILE}}   → 모바일 이미지 Storage URL
--   {{IMAGE_ALT}}      → image_alt 값
--
-- Storage prefix: images/{breakpoint}/ (058 마이그 답습)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.cafe_events
  add column if not exists image_path_desktop text not null default '',
  add column if not exists image_path_tablet  text not null default '',
  add column if not exists image_path_mobile  text not null default '';

comment on column public.cafe_events.image_path_desktop is
  '데스크탑 이미지 Storage URL (cafe-events/images/desktop/*). '
  'EventBanner 가 HTML 안 {{IMAGE_DESKTOP}} placeholder 를 이 값으로 치환.';
comment on column public.cafe_events.image_path_tablet is
  '태블릿 이미지. 비어있으면 desktop 값으로 fallback. {{IMAGE_TABLET}} 치환.';
comment on column public.cafe_events.image_path_mobile is
  '모바일 이미지. 비어있으면 desktop 값으로 fallback. {{IMAGE_MOBILE}} 치환.';
