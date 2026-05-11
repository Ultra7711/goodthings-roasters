-- ══════════════════════════════════════════════════════════════════════════
-- 048_fix_cafe_menu_b01_name.sql
-- 한글 표기 오타 정정 — cafe_menu_items b01 + products "에디오피아"
-- (S216-D Q4 검증 중 발견)
--
-- 배경:
--   - cafeMenu.ts seed 데이터의 b01 name 이 "블랜딩" (오타) 으로 입력됨
--   - products.ts seed 데이터의 "에디오피아 부쿠 후루파" 가 "에티오피아"의 오타
--   - 047 / 046 seed 적용 시 DB row 에 그대로 INSERT 됨
--   - 검색 시 정확한 표기로 매칭 불가 + 표기 일관성 깨짐
--   - SYNONYM_CLASSES 에 양방향 동의어 등록 (블랜딩↔블렌딩, 에디오피아↔에티오피아)
--
-- 영향:
--   - cafe_menu_items.name 1 row (b01)
--   - products.name 1 row (Drip Bag 에티오피아)
--   - revalidateTag('cafe-menu') / revalidateTag('products') 다음 배포로 자동 처리
--   - 기존 menu_likes / 통계 / 주문 / 구독 영향 없음 (id/slug 불변)
--
-- 실행: Supabase 대시보드 SQL Editor 에 붙여넣고 실행
--       (출시 전 일괄 처리 권장 — 사용자 결정)
-- ══════════════════════════════════════════════════════════════════════════

-- 1. cafe_menu_items b01 "블랜딩" → "블렌딩"
UPDATE cafe_menu_items
SET name = '블렌딩'
WHERE id = 'b01' AND name = '블랜딩';

-- 2. products "에디오피아 부쿠 후루파" → "에티오피아 부쿠 후루파"
UPDATE products
SET name = '에티오피아 부쿠 후루파 Ethiopia Buku Hurupa'
WHERE name = '에디오피아 부쿠 후루파 Ethiopia Buku Hurupa';

-- 검증 — 각 1 row affected 여야 함
-- SELECT id, name FROM cafe_menu_items WHERE id = 'b01';
-- SELECT id, name FROM products WHERE name LIKE '%에티오피아%';
