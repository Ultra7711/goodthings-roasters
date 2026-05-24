-- ═══════════════════════════════════════════════════════════════════════════
-- 072_banners_data_migration.sql — cafe_events + signature → banners 이전 (S269)
--
-- 배경:
--   - 071 에서 banners 통합 테이블 + Storage 버킷 신설 (data 0).
--   - 본 마이그가 기존 두 도메인의 row 를 banners 테이블에 복제.
--   - **legacy 무변경** — cafe_events 와 site_settings.signature row 는 그대로 유지.
--   - 코드가 banners 로 fetch 하기 시작한 후 (별 sprint 074) legacy drop.
--
-- 본 마이그 책임:
--   1) cafe_events 전체 row → banners (kind='cafe_event' · id 보존)
--   2) site_settings.signature 단일 row → banners (kind='signature' · id 자동 생성)
--
-- 본 마이그 비책임 (별 마이그):
--   - Storage 파일 이전: 점진 이전 결정 (S269) — 신규 업로드부터 banners 버킷.
--     기존 cafe-events / season-banners 의 파일은 image_path 절대 URL 로 fetch 정상.
--   - legacy 정리 (074 별 sprint): cafe_events drop · site_settings.signature row
--     delete · cafe-events / season-banners 버킷 drop.
--
-- 안전성:
--   - INSERT 만 — UPDATE/DELETE 없음 → rollback 시 `DELETE FROM banners` 한 줄.
--   - cafe_events 의 id (uuid) 보존 → banners.id 도 동일. 향후 reference 추적 용이.
--   - signature id 는 gen_random_uuid (default).
--   - partial UNIQUE (banners_only_one_signature) 이 signature 복수 row 차단.
--
-- 재실행:
--   - cafe_events INSERT 는 ON CONFLICT (id) DO NOTHING — 중복 키 무시.
--   - signature INSERT 는 partial UNIQUE 가 차단 (이미 signature row 있으면 fail).
--     → 본 마이그 재실행 시 signature INSERT 부분만 fail. 안전 재실행을 위해
--       NOT EXISTS 가드 추가.
--
-- 검증 (마이그 후):
--   select kind, count(*) from public.banners group by kind;
--   -- expected: 'cafe_event' = (select count(*) from cafe_events)
--   --           'signature'  = 1 (site_settings.signature 가 있다면)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. cafe_events → banners (kind='cafe_event') ─────────────────────────
insert into public.banners (
  id, kind, enabled,
  custom_html_path,
  image_path_desktop, image_path_tablet, image_path_mobile,
  image_blur_desktop, image_blur_tablet, image_blur_mobile,
  aspect_desktop, aspect_tablet, aspect_mobile,
  image_alt,
  headline_text, subhead_text, cta_text, cta_href,
  start_date, end_date, sort_order,
  type,
  created_at, updated_at, updated_by
)
select
  ce.id,
  'cafe_event'::banner_kind,
  ce.enabled,
  ce.custom_html_path,
  ce.image_path_desktop, ce.image_path_tablet, ce.image_path_mobile,
  ce.image_blur_desktop, ce.image_blur_tablet, ce.image_blur_mobile,
  ce.aspect_desktop, ce.aspect_tablet, ce.aspect_mobile,
  ce.image_alt,
  ce.headline_text, ce.subhead_text, ce.cta_text, ce.cta_href,
  ce.start_date, ce.end_date, ce.sort_order,
  ce.type,
  ce.created_at, ce.updated_at, ce.updated_by
from public.cafe_events ce
on conflict (id) do nothing;

-- ── 2. site_settings.signature → banners (kind='signature') ──────────────
-- jsonb payload 추출. NULL/누락 시 default 값 (071 의 column default 와 정합).
-- partial UNIQUE (banners_only_one_signature) 가 복수 row 차단 — NOT EXISTS 가드로
-- 본 마이그 재실행 안전성 확보.
insert into public.banners (
  kind, enabled,
  custom_html_path,
  image_path_desktop, image_path_tablet, image_path_mobile,
  image_blur_desktop, image_blur_tablet, image_blur_mobile,
  aspect_desktop, aspect_tablet, aspect_mobile,
  image_alt,
  headline_text, subhead_text, cta_text, cta_href
  -- start_date / end_date / sort_order 는 default (NULL / NULL / 0)
  -- type 은 NULL (signature)
  -- id / created_at / updated_at 은 default
  -- updated_by 는 NULL (시드 시점 운영자 정보 없음 — 운영자가 다음 편집 시 채워짐)
)
select
  'signature'::banner_kind,
  coalesce((ss.value->>'enabled')::boolean, false),
  coalesce(ss.value->>'custom_html_path', ''),
  coalesce(ss.value->>'image_path_desktop', ''),
  coalesce(ss.value->>'image_path_tablet', ''),
  coalesce(ss.value->>'image_path_mobile', ''),
  coalesce(ss.value->>'image_blur_desktop', ''),
  coalesce(ss.value->>'image_blur_tablet', ''),
  coalesce(ss.value->>'image_blur_mobile', ''),
  coalesce(ss.value->>'aspect_desktop', '1320/600'),
  coalesce(ss.value->>'aspect_tablet', '1024/520'),
  coalesce(ss.value->>'aspect_mobile', '390/520'),
  coalesce(ss.value->>'image_alt', ''),
  coalesce(ss.value->>'headline_text', ''),
  coalesce(ss.value->>'subhead_text', ''),
  coalesce(ss.value->>'cta_text', ''),
  coalesce(ss.value->>'cta_href', '')
from public.site_settings ss
where ss.key = 'signature'
  and not exists (
    select 1 from public.banners b where b.kind = 'signature'
  );

-- ── 3. 검증 코멘트 ───────────────────────────────────────────────────────
-- 마이그 적용 후 다음 쿼리로 결과 확인:
--
--   select kind, count(*)
--   from public.banners
--   group by kind
--   order by kind;
--
-- expected:
--   cafe_event | (cafe_events 의 row count)
--   signature  | 1 (site_settings.signature 가 존재했다면)
--
-- 또한 cafe_events.id 와 banners(kind='cafe_event').id 가 일치하는지:
--   select count(*)
--   from public.cafe_events ce
--   left join public.banners b on b.id = ce.id and b.kind = 'cafe_event'
--   where b.id is null;
--   -- expected: 0 (모든 cafe_events 가 banners 에 옮겨졌음)
