-- ═══════════════════════════════════════════════════════════════════════════
-- 085_user_reviews.sql — 유저 리뷰 본체 (Phase 1 Step 1)
--
-- 설계 출처: docs/review-implementation-plan.md (S313 확정 + S314 권한 재검토)
--
-- 핵심 결정:
--   - 작성 자격(DEC-R-auth · S314): 상품=실 구매자만(order_items 구매 EXISTS 강제) /
--     카페 메뉴=회원 누구나. 구매 판정 = paid/shipping/delivered.
--   - 작성자 표시 = author_nickname 스냅샷(profiles 는 본인만 select → 타인 리뷰
--     닉네임 join 불가). 작성 시 트리거가 profiles.nickname 으로 강제(사칭 차단).
--     닉네임 변경 시 앱(updateNickname)이 본인 리뷰 author_nickname 동기화.
--   - 탈퇴 시 익명 보존: user_id on delete set null (author_nickname 으로 표시 유지).
--   - 1인 1대상 1리뷰 (deleted 제외 → 재작성 허용).
--   - status 전이: 작성자는 soft delete(deleted)만, approved↔blocked 는 어드민만(트리거).
--
-- 재사용: menu_likes(025) RLS · set_updated_at(001) · is_admin(020).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. reviews 테이블 ──────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid (),

  -- 탈퇴 시 익명 보존 (set null) — author_nickname 스냅샷으로 표시 유지.
  user_id uuid references auth.users (id) on delete set null,

  -- 작성 시점 닉네임 스냅샷 (트리거가 profiles.nickname 으로 강제 — 사칭 차단·공개 노출 안전).
  author_nickname text not null,

  -- 대상: 상품(products 도메인) XOR 메뉴(cafe 도메인).
  product_slug text,
  menu_id text references public.cafe_menu_items (id) on delete cascade,

  rating int2 not null,
  body text not null,

  -- pending(AI 큐) / approved(공개) / blocked(차단) / deleted(soft delete)
  status text not null default 'approved',

  helpful_count int not null default 0,        -- 도움돼요 캐시 (트리거 동기화)
  moderation_result jsonb,                      -- Phase 2 AI 필터 결과 보존

  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),

  -- 제약
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_length check (char_length(body) between 1 and 2000),
  constraint reviews_status_valid check (status in ('pending', 'approved', 'blocked', 'deleted')),
  constraint reviews_author_nickname_length check (char_length(author_nickname) between 2 and 20),
  -- 상품 XOR 메뉴 (정확히 하나)
  constraint reviews_target_xor check (
    (product_slug is not null and menu_id is null)
    or
    (product_slug is null and menu_id is not null)
  )
);

-- 1인 1대상 1리뷰 (deleted 제외 → 삭제 후 재작성 허용). user_id null(탈퇴) 은 무관.
create unique index reviews_user_product_uniq
  on public.reviews (user_id, product_slug)
  where product_slug is not null and status <> 'deleted';
create unique index reviews_user_menu_uniq
  on public.reviews (user_id, menu_id)
  where menu_id is not null and status <> 'deleted';

-- 조회/정렬 인덱스 (approved 만 — 공개 목록)
create index reviews_product_idx on public.reviews (product_slug, created_at desc) where status = 'approved';
create index reviews_menu_idx    on public.reviews (menu_id, created_at desc)      where status = 'approved';
create index reviews_helpful_idx on public.reviews (helpful_count desc)            where status = 'approved';

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at ();

-- ── 2. author_nickname 강제 트리거 (사칭 차단) ─────────────────────────
-- insert 시 앱이 넘긴 값 무시하고 항상 작성자 profiles.nickname 으로 세팅.
create or replace function public.set_review_author_nickname ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  select nickname into new.author_nickname
  from public.profiles where id = new.user_id;

  -- profiles.nickname 은 backfill(084)로 항상 존재. 방어적 fallback.
  if new.author_nickname is null or char_length(new.author_nickname) < 2 then
    new.author_nickname := '익명';
  end if;
  return new;
end;
$$;

create trigger reviews_set_author_nickname
  before insert on public.reviews
  for each row execute function public.set_review_author_nickname ();

-- ── 3. status 전이 제한 트리거 ─────────────────────────────────────────
-- 작성자 본인: status 변경은 'deleted'(soft delete)로만. approved↔blocked 차단.
-- 어드민: 자유 전이 (모더레이션).
create or replace function public.enforce_review_status_transition ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.status is distinct from old.status then
    if not public.is_admin ((select auth.uid ())) then
      if new.status <> 'deleted' then
        raise exception 'status 변경은 어드민만 가능합니다 (작성자는 삭제만 가능)'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_enforce_status_transition
  before update on public.reviews
  for each row execute function public.enforce_review_status_transition ();

-- ── 4. RLS ─────────────────────────────────────────────────────────────
alter table public.reviews enable row level security;
alter table public.reviews force row level security;

-- select: approved 공개 (비로그인 포함)
create policy "reviews_select_public" on public.reviews
  for select using (status = 'approved');

-- select: 본인 전체 (자기 pending/blocked/deleted 확인용)
create policy "reviews_select_own" on public.reviews
  for select to authenticated using (user_id = (select auth.uid ()));

-- select: 어드민 전체
create policy "reviews_select_admin" on public.reviews
  for select to authenticated using (public.is_admin ((select auth.uid ())));

-- insert: 본인 + 도메인 게이팅 (DEC-R-auth)
--   메뉴 = authenticated 누구나 / 상품 = 구매 이력 EXISTS 강제 (server action 우회 차단)
create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid ())
    and status in ('pending', 'approved')
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

-- update: 본인 (body/rating 수정 + soft delete — status 전이는 트리거가 제한)
create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid ()))
  with check (user_id = (select auth.uid ()));

-- update: 어드민 (모더레이션 — status 전이 자유)
create policy "reviews_update_admin" on public.reviews
  for update to authenticated
  using (public.is_admin ((select auth.uid ())))
  with check (public.is_admin ((select auth.uid ())));

-- delete(hard) 정책 없음 — soft delete(status='deleted')만. 영구삭제는 어드민 RPC(Step 5).

-- ── 5. review_helpfuls (도움돼요 · menu_likes 패턴) ────────────────────
create table public.review_helpfuls (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now (),
  primary key (review_id, user_id)
);

alter table public.review_helpfuls enable row level security;
alter table public.review_helpfuls force row level security;

-- 도움돼요 수 집계용 — 누구나 조회
create policy "review_helpfuls_select_all" on public.review_helpfuls
  for select using (true);
-- 본인만 추가
create policy "review_helpfuls_insert_own" on public.review_helpfuls
  for insert to authenticated with check (user_id = (select auth.uid ()));
-- 본인만 취소
create policy "review_helpfuls_delete_own" on public.review_helpfuls
  for delete to authenticated using (user_id = (select auth.uid ()));

-- ── 6. helpful_count 동기화 트리거 ─────────────────────────────────────
create or replace function public.sync_review_helpful_count ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
  elsif tg_op = 'DELETE' then
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  return null;
end;
$$;

create trigger review_helpfuls_sync_count
  after insert or delete on public.review_helpfuls
  for each row execute function public.sync_review_helpful_count ();

-- ── 7. 집계 RPC — 평균/분포/총개수 (SECURITY DEFINER · approved 만) ─────
-- 카드 N+1 회피용 SSR 소비 (menuLikesServer snapshot 패턴). 단일 대상 조회.
-- (목록용 batch 집계는 Step 4 snapshot 에서 추가.)
create or replace function public.get_review_summary (
  p_product_slug text default null,
  p_menu_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'total', count(*),
    'average', coalesce(round(avg(rating)::numeric, 1), 0),
    'distribution', jsonb_build_object(
      '1', count(*) filter (where rating = 1),
      '2', count(*) filter (where rating = 2),
      '3', count(*) filter (where rating = 3),
      '4', count(*) filter (where rating = 4),
      '5', count(*) filter (where rating = 5)
    )
  )
  from public.reviews
  where status = 'approved'
    and (
      (p_product_slug is not null and product_slug = p_product_slug)
      or (p_menu_id is not null and menu_id = p_menu_id)
    );
$$;

grant execute on function public.get_review_summary (text, text) to anon, authenticated;

comment on table public.reviews is
  '유저 리뷰 (텍스트). 상품=구매자만 / 메뉴=회원 누구나. author_nickname 스냅샷 · 탈퇴 시 익명 보존.';
comment on function public.get_review_summary (text, text) is
  '리뷰 평균/분포/총개수 집계 (approved 만 · SECURITY DEFINER). 카드 N+1 회피.';
