-- menu_likes: 카페 메뉴 좋아요 테이블
-- menu_id 는 cafeMenu.ts CAFE_MENU[].id (slug 문자열) — FK 없이 varchar 사용
-- 나중에 카페 메뉴 DB 전환 시 FK 추가 예정

CREATE TABLE IF NOT EXISTS menu_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id    VARCHAR(50) NOT NULL,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT menu_likes_unique UNIQUE (menu_id, user_id)
);

ALTER TABLE menu_likes ENABLE ROW LEVEL SECURITY;

-- 누구나 좋아요 수 조회 가능 (집계용 SELECT)
CREATE POLICY "menu_likes_select_all" ON menu_likes
  FOR SELECT USING (true);

-- 로그인 사용자만 자신의 좋아요 추가 가능
CREATE POLICY "menu_likes_insert_own" ON menu_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 자신의 좋아요만 삭제 가능
CREATE POLICY "menu_likes_delete_own" ON menu_likes
  FOR DELETE USING (auth.uid() = user_id);
