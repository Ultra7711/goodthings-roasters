-- ═══════════════════════════════════════════════════════════════════════════
-- 063_site_settings_signature_seo_meta.sql — signature SEO 메타 슬롯 추가 (S239 B-1b)
--
-- 배경:
--   - 062 iframe 모델은 텍스트가 운영자 HTML 안 → iframe srcDoc 내부 document.
--   - iframe 안 텍스트는 검색엔진/스크린리더에서 분리된 document 로 인식되어
--     SEO/a11y 진입이 약함.
--   - 운영자 워크플로우 (이미지+텍스트 분리 + AI HTML 변환) 의 텍스트 분리 이점을
--     회수하기 위해 SEO 메타 텍스트 별도 슬롯 도입.
--   - SignatureChapterView 가 iframe 외부에 sr-only `<h2>/<p>/<a>` 로 출력 →
--     시각 사용자는 iframe 안 텍스트만 보고, 검색엔진/스크린리더는 메타 텍스트 인식.
--
-- 변경:
--   - site_settings 의 key='signature' row value JSONB 에 4 필드 추가:
--     headline_text · subhead_text · cta_text · cta_href.
--   - 기존 필드 (062 payload) 유지 — JSONB UPDATE 로 누락 키 채우기만.
--   - enabled 상태 보존 (운영자가 이미 활성화한 경우 영향 없음).
--
-- 새 payload schema (lib/siteSettings.ts SignatureSettingsSchema 와 1:1):
--   {
--     enabled            : bool,
--     custom_html_path   : text,
--     image_path_desktop : text,
--     image_path_tablet  : text,
--     image_path_mobile  : text,
--     aspect_desktop     : text,
--     aspect_tablet      : text,
--     aspect_mobile      : text,
--     image_alt          : text,
--     headline_text      : text,   -- ← 신규 (검색용 h2 · 빈 값이면 sr-only 미출력)
--     subhead_text       : text,   -- ← 신규 (검색용 p · 빈 값이면 sr-only 미출력)
--     cta_text           : text,   -- ← 신규 (검색용 a 텍스트 · 빈 값이면 sr-only 미출력)
--     cta_href           : text    -- ← 신규 (CTA 링크 · cta_text 없으면 무시)
--   }
--
-- Rollback:
--   - 메타 필드만 추가하므로 schema rollback 불필요 — 미사용 시 빈 문자열 그대로.
-- ═══════════════════════════════════════════════════════════════════════════

update public.site_settings
set value = value
  || jsonb_build_object(
       'headline_text', coalesce(value->>'headline_text', ''),
       'subhead_text',  coalesce(value->>'subhead_text', ''),
       'cta_text',      coalesce(value->>'cta_text', ''),
       'cta_href',      coalesce(value->>'cta_href', '')
     )
where key = 'signature';
