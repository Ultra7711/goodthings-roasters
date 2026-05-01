-- ═══════════════════════════════════════════════════════════════════════════
-- 028_admin_storage_buckets.sql — 어드민 이미지 업로드용 Storage 버킷 (A-6)
--
-- 목적:
--   - product-images : 상품 이미지 (Group E)
--   - menu-images    : 카페 메뉴 이미지 (Group F)
--   - gooddays-images: 굿데이즈 갤러리 이미지 (Group J)
--   - season-banners : 시즌 배너 이미지 (Group H)
--
-- 정책:
--   - 모두 public 버킷 (직접 URL 노출). SELECT public, 쓰기는 is_admin() 만.
--   - 020_profiles_role_rbac.sql 의 is_admin() 헬퍼 재사용.
--   - 파일 크기 5MB 제한 (이미지 기준 충분, 어드민 실수 방지).
--   - MIME 타입 화이트리스트: image/webp · image/avif · image/jpeg · image/png · image/svg+xml.
--
-- 참조:
--   - docs/admin-implementation-plan.md §4-3 (Storage 버킷 구조)
--   - https://supabase.com/docs/guides/storage/security/access-control
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 버킷 4종 일괄 생성 ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880, -- 5MB
    array['image/webp','image/avif','image/jpeg','image/png','image/svg+xml']
  ),
  (
    'menu-images',
    'menu-images',
    true,
    5242880,
    array['image/webp','image/avif','image/jpeg','image/png','image/svg+xml']
  ),
  (
    'gooddays-images',
    'gooddays-images',
    true,
    5242880,
    array['image/webp','image/avif','image/jpeg','image/png']
  ),
  (
    'season-banners',
    'season-banners',
    true,
    5242880,
    array['image/webp','image/avif','image/jpeg','image/png']
  )
on conflict (id) do nothing;

-- ── RLS 정책 ─────────────────────────────────────────────────────────────
-- storage.objects 의 RLS 는 이미 활성화 상태. 버킷별 정책 추가.
--
-- INSERT/UPDATE/DELETE → public.is_admin(auth.uid())
-- SELECT → public (anon 도 읽기 가능 — 이미지 직접 노출)

-- product-images
create policy "product-images admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
);

create policy "product-images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
);

create policy "product-images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
);

create policy "product-images public read"
on storage.objects for select
to public
using (bucket_id = 'product-images');

-- menu-images
create policy "menu-images admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and public.is_admin(auth.uid())
);

create policy "menu-images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'menu-images'
  and public.is_admin(auth.uid())
);

create policy "menu-images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and public.is_admin(auth.uid())
);

create policy "menu-images public read"
on storage.objects for select
to public
using (bucket_id = 'menu-images');

-- gooddays-images
create policy "gooddays-images admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gooddays-images'
  and public.is_admin(auth.uid())
);

create policy "gooddays-images admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'gooddays-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'gooddays-images'
  and public.is_admin(auth.uid())
);

create policy "gooddays-images admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gooddays-images'
  and public.is_admin(auth.uid())
);

create policy "gooddays-images public read"
on storage.objects for select
to public
using (bucket_id = 'gooddays-images');

-- season-banners
create policy "season-banners admin write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'season-banners'
  and public.is_admin(auth.uid())
);

create policy "season-banners admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'season-banners'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'season-banners'
  and public.is_admin(auth.uid())
);

create policy "season-banners admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'season-banners'
  and public.is_admin(auth.uid())
);

create policy "season-banners public read"
on storage.objects for select
to public
using (bucket_id = 'season-banners');
