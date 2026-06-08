-- ═══════════════════════════════════════════════════════════════════════════
-- 088_review_insert_blocked.sql — 리뷰 insert 시 blocked 허용 (Phase 2 AI 필터)
--
-- 배경:
--   085 reviews_insert_own 은 insert status 를 ('pending','approved') 로만 제한했다.
--   Phase 2 동기 검수(createReview 안에서 OpenAI Moderation 호출)는 욕설 감지 시
--   리뷰를 status='blocked' 로 저장해야 한다 — moderation_result 보존 + 어드민
--   /admin/reviews "차단됨" 탭 검토 + blocked 알림벨 연계를 위함.
--
-- 변경:
--   insert status 화이트리스트에 'blocked' 추가 → ('pending','approved','blocked').
--   나머지 조건(본인 + 도메인 게이팅: 메뉴=회원 / 상품=구매 EXISTS)은 085 그대로.
--
-- 보안:
--   blocked 는 reviews_select_public(approved 만) 으로 공개 노출 0 · 본인/어드민만 조회.
--   server action(createReview)이 검수 결과로 status 를 결정하므로 클라가 임의 status
--   를 주입할 수 없고, 직접 API 우회로 blocked insert 해도 본인만 보여 악용 가치 0.
--   approved↔blocked 사후 전이는 여전히 어드민만(085 enforce_review_status_transition).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "reviews_insert_own" on public.reviews;

create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid ())
    and status in ('pending', 'approved', 'blocked')
    and (
      -- 카페 메뉴: 회원 누구나
      (menu_id is not null and product_slug is null)
      or
      -- 상품: 실 구매자만 (paid/shipping/delivered)
      (
        product_slug is not null and menu_id is null
        and exists (
          select 1
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where o.user_id = (select auth.uid ())
            and oi.product_slug = reviews.product_slug
            and o.status in ('paid', 'shipping', 'delivered')
        )
      )
    )
  );
