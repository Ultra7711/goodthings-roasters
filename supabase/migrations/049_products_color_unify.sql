-- ══════════════════════════════════════════════════════════════════════════
-- 049_products_color_unify.sql
-- products.color 일괄 #eaeaea 적용 + default 변경 (S231-6a)
--
-- 배경:
--   - products.color 는 PDP 1:1 이미지 비율을 벗어날 때만 노출되는 배경 hex
--   - 운영 정책: 모든 상품 동일하게 #eaeaea 적용 (예외 발생 시 어드민에서 개별 수정)
--   - 046_products_schema.sql 의 DEFAULT 미지정 → 신규 등록 시 빈 값 방지를 위해
--     DEFAULT '#eaeaea' 명시 추가
--
-- 영향:
--   - products.color = '#eaeaea' (전체 row · is_active 무관)
--   - ALTER COLUMN ... SET DEFAULT '#eaeaea' (이후 신규 INSERT 기본값)
--   - 어드민 ProductEditForm color 필드는 유지 (개별 예외 수정 가능)
--
-- 실행: Supabase 대시보드 SQL Editor 에 붙여넣고 실행
-- ══════════════════════════════════════════════════════════════════════════

-- 1. 전체 row 일괄 적용
UPDATE products
SET color = '#eaeaea'
WHERE color IS DISTINCT FROM '#eaeaea';

-- 2. 신규 INSERT 기본값
ALTER TABLE products
  ALTER COLUMN color SET DEFAULT '#eaeaea';

-- 검증
-- SELECT count(*) AS not_unified FROM products WHERE color <> '#eaeaea';
--   → 0 이어야 함
-- SELECT column_default FROM information_schema.columns
--   WHERE table_name='products' AND column_name='color';
--   → '''#eaeaea'''::text
