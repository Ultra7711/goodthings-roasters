-- ═══════════════════════════════════════════════════════════════════════════
-- 059_cafe_events_overlay_redesign.sql — cafe_events 모델 재설계 (S234 후속)
--
-- 배경:
--   - 기존 cafe-event = sand 2-column (이미지 + 텍스트 옆 분리). EventBanner
--     가 eyebrow/h4/meta/description/cta 5 필드를 별도 렌더.
--   - 신규 운영 형식 = 이미지 + 텍스트가 한 디자인으로 합쳐진 이미지 배너.
--     · 운영자가 미리 제작한 (이미지 + 그에 맞춘 CSS) 쌍을 업로드.
--     · 반응형 이미지 3종 (desktop/tablet/mobile).
--     · 텍스트·비율·배치 모두 CSS 에 포함 → 어드민 필드는 이미지·CSS·alt 만.
--
-- 변경:
--   - cafe_events 테이블 컬럼 11개 DROP, 신규 4개 ADD.
--   - 기존 seed row TRUNCATE (5월 가정의 달 이벤트 등 dead 데이터).
--   - cafe-events 버킷 allowed_mime_types 에 text/css 추가.
--   - file_size_limit 5MB 유지 (이미지 + CSS 모두 5MB 한도 충분).
--
-- DROP 컬럼:
--   eyebrow, h4, meta, description, image_path, recurring,
--   linked_menu_slug, season_label, partner_name, cta_target
--   (image_alt 는 유지 — 신규 모델도 alt 필요)
--
-- ADD 컬럼:
--   image_path_desktop  text not null default ''
--   image_path_tablet   text not null default ''  -- 비어있으면 desktop fallback
--   image_path_mobile   text not null default ''  -- 비어있으면 desktop fallback
--   custom_css_path     text not null default ''  -- Storage public URL (cafe-events/css/*)
--
-- 유지:
--   id, type (enum 5종 그대로 — 우선순위 의미 유지),
--   enabled, image_alt, start_date, end_date, sort_order,
--   created_at, updated_at, updated_by
--
-- Rollback:
--   기존 모델 부활 시 035 마이그의 컬럼 정의 + 기존 EventBanner.tsx
--   복원 필요. seed row 는 git history 에서 복원.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. 기존 seed/운영 row 삭제 ──────────────────────────────────────────
-- 신규 모델로 재입력 필요. 기존 row 의 dropped 컬럼 데이터는 의미 손실.
truncate table public.cafe_events;

-- ── 2. dropped 컬럼 제거 ────────────────────────────────────────────────
alter table public.cafe_events drop column if exists eyebrow;
alter table public.cafe_events drop column if exists h4;
alter table public.cafe_events drop column if exists meta;
alter table public.cafe_events drop column if exists description;
alter table public.cafe_events drop column if exists image_path;
alter table public.cafe_events drop column if exists recurring;
alter table public.cafe_events drop column if exists linked_menu_slug;
alter table public.cafe_events drop column if exists season_label;
alter table public.cafe_events drop column if exists partner_name;
alter table public.cafe_events drop column if exists cta_target;

-- ── 3. 신규 컬럼 추가 ───────────────────────────────────────────────────
alter table public.cafe_events
  add column if not exists image_path_desktop text not null default '',
  add column if not exists image_path_tablet  text not null default '',
  add column if not exists image_path_mobile  text not null default '',
  add column if not exists custom_css_path    text not null default '';

comment on column public.cafe_events.image_path_desktop is
  '데스크탑 이미지 Storage public URL (cafe-events/images/desktop/*). 필수.';
comment on column public.cafe_events.image_path_tablet is
  '태블릿 이미지. 비어있으면 desktop fallback.';
comment on column public.cafe_events.image_path_mobile is
  '모바일 이미지. 비어있으면 desktop fallback.';
comment on column public.cafe_events.custom_css_path is
  '이미지 위 텍스트 overlay 를 정의하는 CSS 파일 Storage public URL (cafe-events/css/*). '
  '<link rel="stylesheet"> 로 EventBanner 가 주입.';

-- ── 4. storage 버킷 MIME 정책 확장 (text/css 추가) ──────────────────────
-- cafe-events 버킷에 이미지뿐 아니라 CSS 파일도 업로드 가능하게 변경.
-- prefix 'images/' 와 'css/' 로 폴더 분리 (RLS 정책은 prefix 무관 admin only).
update storage.buckets
set allowed_mime_types = array[
  'image/webp',
  'image/avif',
  'image/jpeg',
  'image/png',
  'text/css'
]
where id = 'cafe-events';
