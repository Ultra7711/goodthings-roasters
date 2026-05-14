-- ═══════════════════════════════════════════════════════════════════════════
-- 050_product_images_is_active.sql — 이미지 안전장치 (S231-3)
--
-- 목적:
--   product_images 에 is_active 컬럼 추가. 신규 업로드는 default false
--   (action 단에서 박음 — 049 패턴 답습). 운영자가 어드민에서 확인 후 토글로
--   공개 — 잘못 올린 이미지가 즉시 사이트에 노출되는 사고 차단.
--
-- B2C 노출:
--   lib/productsServer.ts 의 mapProductRow 에서 is_active=true 만 사이트 노출.
--   admin RouteHandler fetch (lib/admin/productsServer.ts) 는 전체 fetch 유지.
--
-- 기존 6 상품 호환:
--   default true 로 column 추가 → 기존 product_images row 들 (seed/실 데이터)
--   영향 0. 신규 업로드 (uploadProductImageAction) 만 false 박음.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.product_images
  add column if not exists is_active boolean not null default true;

comment on column public.product_images.is_active is
  '이미지 사이트 노출 여부. 신규 업로드 default false (안전장치 — S231-3). 운영자가 어드민에서 토글로 공개.';
