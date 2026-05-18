-- ═══════════════════════════════════════════════════════════════════════════
-- 062_site_settings_signature_iframe.sql — signature payload 재구성 (S237)
--
-- 배경:
--   - 기존 signature payload (S146 V2 §2.2) = title/subtitle/eyebrow/
--     flavor_chips/product_slug/image_path/image_alt (단일 카드).
--   - 운영자가 매 시즌 자유 디자인 어려움 (텍스트·SVG·폰트 표현 한계).
--   - 카페 이벤트 배너 (060/061) 모델 답습 → iframe HTML + image 3종 +
--     placeholder 치환 + aspect 자동 측정. 운영자가 매 시즌 디자인 자유도 확보.
--
-- 변경:
--   - site_settings 의 key='signature' row 의 value JSONB 를 새 payload 로 UPDATE.
--   - 기존 데이터는 의미 손실 (시즌 갱신 모델이라 다음 시즌 새 입력 전제).
--   - enabled=false 로 reset — 운영자가 새 모델로 입력 후 활성화.
--   - season-banners 버킷 allowed_mime_types 에 text/html 추가 (signature/html/*
--     prefix 사용).
--
-- 새 payload schema (lib/siteSettings.ts SignatureSettingsSchema 와 1:1):
--   {
--     enabled            : bool,
--     custom_html_path   : text,   -- Storage public URL (season-banners/signature/html/*)
--     image_path_desktop : text,   -- (season-banners/signature/images/desktop/*)
--     image_path_tablet  : text,   -- 비어있으면 desktop fallback
--     image_path_mobile  : text,   -- 비어있으면 desktop fallback
--     aspect_desktop     : text,   -- CSS aspect-ratio 형식 "W/H" (예: "1320/600")
--     aspect_tablet      : text,
--     aspect_mobile      : text,
--     image_alt          : text
--   }
--
-- HTML placeholder 규칙 (운영자 가이드):
--   {{IMAGE_DESKTOP}} / {{IMAGE_TABLET}} / {{IMAGE_MOBILE}} / {{IMAGE_ALT}}
--
-- Rollback:
--   - 시그니처 기존 모델 부활 시 034_site_settings_signature.sql 의 seed 참고하여
--     value 복원 + 코드 차원에서 SignatureChapter 마크업·schema 복원 선행 필요.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. signature row 의 value 재구성 (enabled=false reset) ──────────────────
update public.site_settings
set value = jsonb_build_object(
  'enabled',            false,
  'custom_html_path',   '',
  'image_path_desktop', '',
  'image_path_tablet',  '',
  'image_path_mobile',  '',
  'aspect_desktop',     '1320/600',
  'aspect_tablet',      '1024/520',
  'aspect_mobile',      '390/520',
  'image_alt',          ''
)
where key = 'signature';

-- 만약 signature row 가 아직 없으면 신규 INSERT (defensive).
insert into public.site_settings (key, value)
values
  (
    'signature',
    jsonb_build_object(
      'enabled',            false,
      'custom_html_path',   '',
      'image_path_desktop', '',
      'image_path_tablet',  '',
      'image_path_mobile',  '',
      'aspect_desktop',     '1320/600',
      'aspect_tablet',      '1024/520',
      'aspect_mobile',      '390/520',
      'image_alt',          ''
    )
  )
on conflict (key) do nothing;

-- ── 2. season-banners 버킷 MIME 정책 확장 (text/html 추가) ──────────────────
-- signature/html/* prefix 로 운영자 .html 파일 업로드.
-- signature/images/{desktop,tablet,mobile}/* prefix 로 이미지 업로드.
-- RLS 정책은 prefix 무관 admin only / public read (028 마이그) 유지.
update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/avif',
  'image/jpeg',
  'image/png',
  'text/html'
]
where id = 'season-banners';
