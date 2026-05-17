-- ═══════════════════════════════════════════════════════════════════════════
-- 060_cafe_events_iframe_html.sql — cafe_events iframe HTML 모델로 진화 (S234 후속)
--
-- 배경:
--   - 059 모델 (이미지 3종 + CSS 1) 으로는 텍스트·SVG·폰트 등 디자인 마크업
--     표현 불가. 운영자가 제공한 .html 파일을 보면 SVG 심볼·외부 폰트·DOM
--     구조 (.desktop-top, .menu-row, .badge-bar 등) 가 핵심.
--   - 단일 .html 파일을 Supabase Storage 에 업로드하고 <iframe sandbox> 로
--     임베드. CSS·이미지·SVG·폰트 모두 운영자 HTML 안에서 처리.
--   - 보안 격리: sandbox 옵션으로 script 차단 (allow-same-origin 만 허용).
--
-- 변경:
--   - DROP: image_path_desktop / image_path_tablet / image_path_mobile /
--           custom_css_path
--   - ADD : custom_html_path (text) — Storage HTML URL · 필수
--           aspect_desktop / aspect_tablet / aspect_mobile (text) —
--             iframe 컨테이너 aspect-ratio (CSS 'W / H' 형식 · 예: '1320/480')
--   - image_alt 유지 (iframe title 속성 + a11y description)
--   - storage cafe-events 버킷 allowed_mime_types 에 text/html 추가
--     (이미 text/css 추가됨 — 059 마이그)
--
-- Rollback:
--   059 모델 부활 시 image_path_* + custom_css_path 컬럼 + EventBanner
--   picture 패턴 복원 필요.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. dropped 컬럼 제거 ────────────────────────────────────────────────
alter table public.cafe_events drop column if exists image_path_desktop;
alter table public.cafe_events drop column if exists image_path_tablet;
alter table public.cafe_events drop column if exists image_path_mobile;
alter table public.cafe_events drop column if exists custom_css_path;

-- ── 2. 신규 컬럼 추가 ───────────────────────────────────────────────────
alter table public.cafe_events
  add column if not exists custom_html_path text not null default '',
  add column if not exists aspect_desktop   text not null default '1320/480',
  add column if not exists aspect_tablet    text not null default '1024/400',
  add column if not exists aspect_mobile    text not null default '390/640';

comment on column public.cafe_events.custom_html_path is
  '운영자 제작 .html 파일 Storage public URL (cafe-events/html/*). '
  '<iframe sandcontainer="allow-same-origin"> 로 EventBanner 가 임베드. '
  '이미지/CSS/SVG/폰트 모두 HTML 내부에서 처리.';
comment on column public.cafe_events.aspect_desktop is
  'iframe 컨테이너 aspect-ratio (>=1024px). CSS aspect-ratio 형식 "W / H" 또는 "W/H". 예: "1320/480"';
comment on column public.cafe_events.aspect_tablet is
  'iframe 컨테이너 aspect-ratio (768~1023px). 예: "1024/400"';
comment on column public.cafe_events.aspect_mobile is
  'iframe 컨테이너 aspect-ratio (<768px). 예: "390/640"';

-- ── 3. storage 버킷 MIME 정책 확장 (text/html 추가) ─────────────────────
update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/avif',
  'image/jpeg',
  'image/png',
  'text/css',
  'text/html'
]
where id = 'cafe-events';
