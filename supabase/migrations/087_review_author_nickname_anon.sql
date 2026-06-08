-- ═══════════════════════════════════════════════════════════════════════════
-- 087_review_author_nickname_anon.sql — author_nickname 트리거 보강
--
-- 배경:
--   085 트리거는 user_id 로 profiles.nickname 을 강제(사칭 차단)하나, user_id 가
--   null 인 경우(탈퇴 익명 보존·시스템/더미 리뷰)는 항상 '익명' 으로 덮어써
--   제공된 닉네임을 살릴 수 없었음.
--
-- 변경:
--   - user_id 존재(로그인 작성): profiles.nickname 강제 (사칭 차단 — 기존 유지)
--   - user_id null(service_role 경로만 가능 · 일반 insert RLS 는 authenticated 강제):
--     제공된 author_nickname 유지, 없을 때만 '익명'
--
-- 보안:
--   일반 사용자 insert 는 RLS(reviews_insert_own)가 user_id = auth.uid() 강제 →
--   user_id null insert 는 service_role(어드민/seed)만 가능 → 사칭 위험 없음.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_review_author_nickname ()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- 로그인 사용자: 사칭 차단 — profiles.nickname 으로 강제
  if new.user_id is not null then
    select nickname into new.author_nickname
    from public.profiles where id = new.user_id;
  end if;

  -- user_id null(익명/시스템/seed) 또는 닉네임 부재: 제공값 유지, 없으면 '익명'
  if new.author_nickname is null or char_length(new.author_nickname) < 2 then
    new.author_nickname := '익명';
  end if;
  return new;
end;
$$;
