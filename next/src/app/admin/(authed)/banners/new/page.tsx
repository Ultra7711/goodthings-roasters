/* ══════════════════════════════════════════
   AdminBannerNewPage — 신규 등록 (S273)
   - searchParams.kind 로 cafe_event / signature 결정
   - list 의 max(sort_order)+1 = default sort_order
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { listBannersAdmin } from '@/lib/admin/bannersServer';
import { BANNER_KINDS, type BannerKind } from '@/lib/banners';
import BannerEditForm from '../BannerEditForm';

type PageProps = {
  searchParams: Promise<{ kind?: string }>;
};

export default async function AdminBannerNewPage({ searchParams }: PageProps) {
  const { kind: kindParam } = await searchParams;
  const kind = (BANNER_KINDS as ReadonlyArray<string>).includes(kindParam ?? '')
    ? (kindParam as BannerKind)
    : null;
  if (!kind) {
    redirect('/admin/banners');
  }

  const banners = await listBannersAdmin(kind);
  const maxSortOrder = banners.reduce(
    (acc, b) => (b.sort_order > acc ? b.sort_order : acc),
    -1,
  );
  const defaultSortOrder = maxSortOrder + 1;

  return (
    <BannerEditForm
      mode="create"
      kind={kind}
      banner={null}
      defaultSortOrder={defaultSortOrder}
    />
  );
}
