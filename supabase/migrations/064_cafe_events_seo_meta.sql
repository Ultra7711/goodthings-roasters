-- ═══════════════════════════════════════════════════════════════════════════
-- 064_cafe_events_seo_meta.sql — cafe_events SEO 메타 슬롯 추가 (S239 B-1b)
--
-- 배경:
--   - 060/061 iframe 모델은 텍스트가 운영자 HTML 안 → iframe srcDoc 내부 document.
--   - iframe 안 텍스트는 검색엔진/스크린리더에서 분리된 document 로 인식되어
--     SEO/a11y 진입이 약함.
--   - signature chapter 와 동일 정책 (063) 답습 — 메타 텍스트 별도 컬럼 + EventBanner
--     가 iframe 외부에 sr-only `<h2>/<p>/<a>` 로 출력.
--
-- 변경:
--   - cafe_events 테이블에 4 컬럼 추가:
--     headline_text · subhead_text · cta_text · cta_href.
--   - 기존 row 는 DEFAULT '' 로 자동 채워짐. 운영자가 어드민에서 입력 시 활성.
--
-- Rollback:
--   - 컬럼 DROP 으로 가능 (데이터 손실).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.cafe_events
  add column if not exists headline_text text not null default '',
  add column if not exists subhead_text  text not null default '',
  add column if not exists cta_text      text not null default '',
  add column if not exists cta_href      text not null default '';

comment on column public.cafe_events.headline_text is
  'iframe 외부 sr-only <h2> 출력. 검색용 메타 (빈 값 = 미출력). 063 signature 답습.';
comment on column public.cafe_events.subhead_text is
  'iframe 외부 sr-only <p> 출력. 검색용 메타 (빈 값 = 미출력).';
comment on column public.cafe_events.cta_text is
  'iframe 외부 sr-only <a> 또는 <span> 출력. 검색용 메타 (빈 값 = 미출력).';
comment on column public.cafe_events.cta_href is
  'CTA 링크. cta_text 없으면 무시. 빈 값 + cta_text 있으면 <span> 으로 출력.';
