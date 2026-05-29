-- ═══════════════════════════════════════════════════════════════════════════
-- 083_newsletter_campaigns_and_images.sql — 뉴스레터 발송 이력 + 본문 이미지 버킷
--   (S250-2 Phase 2 발송 컴포저)
--
-- 1) newsletter_campaigns — 발송 캠페인 이력
--    - 제목 + 블록(jsonb) + 발송 집계(recipient/sent/failed) + 상태 + 발송시각.
--    - blocks 보존 → 어드민에서 "복제하여 재발송" 가능 (DEC: 블록 JSON + 메타).
--    - INSERT 는 service_role(getSupabaseAdmin) 만 — RLS insert 정책 없음.
--    - SELECT 는 admin(is_admin) — 발송 이력 탭 (createRouteHandlerClient).
--
-- 2) newsletter-images 버킷 — 컴포저 본문 이미지
--    - public 버킷 (이메일에서 절대 URL 직접 노출). 028 패턴 1:1 답습.
--    - SELECT public · 쓰기는 is_admin() 만. 5MB · image 4종.
--
-- 참조: 065_newsletter_subscribers.sql · 028_admin_storage_buckets.sql
-- Rollback:
--   drop table public.newsletter_campaigns;
--   delete from storage.buckets where id = 'newsletter-images'; (+ 정책 drop)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) newsletter_campaigns ─────────────────────────────────────────────────
create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  blocks jsonb not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'sent' check (status in ('sent', 'partial', 'failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.newsletter_campaigns is
  '뉴스레터 발송 캠페인 이력. blocks(jsonb) 보존 → 복제 재발송. 발송은 Resend batch (서버 액션).';
comment on column public.newsletter_campaigns.blocks is
  '컴포저 블록 배열(heading/paragraph/image/cta) JSON. newsletterCompose.ts 스키마.';
comment on column public.newsletter_campaigns.recipient_count is
  '발송 시점 active 구독자 수 (발송 대상).';
comment on column public.newsletter_campaigns.sent_count is 'Resend 성공 통수.';
comment on column public.newsletter_campaigns.failed_count is 'Resend 실패 통수.';
comment on column public.newsletter_campaigns.status is
  'sent = 전건 성공 / partial = 일부 실패 / failed = 전건 실패.';

create index if not exists newsletter_campaigns_created_at_idx
  on public.newsletter_campaigns(created_at desc);

-- ── RLS — admin SELECT 만 (INSERT 는 service_role 우회) ──────────────────────
alter table public.newsletter_campaigns enable row level security;

create policy "newsletter_campaigns_admin_select"
  on public.newsletter_campaigns
  for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- ── 2) newsletter-images 버킷 (028 답습) ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'newsletter-images',
  'newsletter-images',
  true,
  5242880, -- 5MB
  array['image/webp','image/avif','image/jpeg','image/png']
)
on conflict (id) do nothing;

create policy "newsletter-images admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'newsletter-images'
  and public.is_admin(auth.uid())
);

create policy "newsletter-images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'newsletter-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'newsletter-images'
  and public.is_admin(auth.uid())
);

create policy "newsletter-images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'newsletter-images'
  and public.is_admin(auth.uid())
);

create policy "newsletter-images public read"
on storage.objects for select
to public
using (bucket_id = 'newsletter-images');
