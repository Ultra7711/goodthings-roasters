-- ═══════════════════════════════════════════════════════════════════════════
-- 034_site_settings_signature.sql — 시그니처 chapter seed (S146 V2 §2.2 PR-1)
--
-- 목적:
--   - 메인 §2.2 시그니처 chapter (Hero 직후 sand 단독 카드) 가 fetch 할 데이터.
--   - 032 의 key/value JSONB 패턴 답습 — 스키마 변경 없이 INSERT 만.
--   - mock 활성화 (`enabled=true`) 으로 chapter 시각 검증 가능.
--
-- 설계 결정 (S146):
--   - product_id (UUID) 가 아닌 product_slug (text) 채택.
--     · next/src/lib/products.ts 의 PRODUCTS 가 정적 배열이며 UUID 필드 없음.
--     · slug 는 PDP 라우트 (/shop/[slug]) 와 일관, B2C 컴포넌트가 직접 lookup.
--   - mock seed = "산뜻한 오후" (slug: refreshing-afternoon)
--     · noteTags (Fruit | Stonefruit | Syrup | Clean After) → 프릳츠 톤
--       으로 한국어 chip 압축 (복숭아 · 살구 · 시럽). Clean After 는 subtitle 에 흡수.
--     · 본문은 advisory §2.3 의 호명 톤 (1~2줄, 명사형, max-width 340 호흡).
--
-- schema 요약 (lib/siteSettings.ts SignatureSettingsSchema 와 1:1):
--   { enabled, eyebrow, product_slug, title, subtitle, flavor_chips,
--     image_path, image_alt }
--
-- 참조:
--   - 032_site_settings.sql           (테이블 + RLS + 기존 3 영역 seed)
--   - memory/advisory_A_signature_raw.html (advisory A 픽셀 spec)
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.site_settings (key, value)
values
  (
    'signature',
    jsonb_build_object(
      'enabled',       true,
      'eyebrow',       'Signature · 2026 SS',
      'product_slug',  'refreshing-afternoon',
      'title',         '산뜻한 오후',
      'subtitle',      '밝은 산미와 깨끗한 여운. 콜롬비아·과테말라·케냐 블렌드.',
      'flavor_chips',  jsonb_build_array('복숭아', '살구', '시럽'),
      'image_path',    '/images/products/pd_img_refreshing_afternoon.webp',
      'image_alt',     '산뜻한 오후 패키지 정면'
    )
  )
on conflict (key) do nothing;
