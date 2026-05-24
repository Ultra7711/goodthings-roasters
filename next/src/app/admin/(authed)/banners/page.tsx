/* ══════════════════════════════════════════
   AdminBannersPage — server component (S273 통합)
   - 두 kind (cafe_event · signature) 모두 fetch
   - searchParams kind / just_created → BannerListClient props
   - BannerListClient 가 kind 탭 + 카드 grid + 화살표 reorder 담당
   ══════════════════════════════════════════ */

import { listBannersAdmin } from '@/lib/admin/bannersServer';
import { BANNER_KINDS, type BannerKind } from '@/lib/banners';
import BannerListClient from './BannerListClient';

type PageProps = {
  searchParams: Promise<{ kind?: string; just_created?: string }>;
};

export default async function AdminBannersPage({ searchParams }: PageProps) {
  const { kind: kindParam, just_created } = await searchParams;
  const initialKind: BannerKind = (BANNER_KINDS as ReadonlyArray<string>).includes(
    kindParam ?? '',
  )
    ? (kindParam as BannerKind)
    : 'cafe_event';

  const [cafeBanners, signatureBanners] = await Promise.all([
    listBannersAdmin('cafe_event'),
    listBannersAdmin('signature'),
  ]);

  return (
    <BannerListClient
      initialCafeBanners={cafeBanners}
      initialSignatureBanners={signatureBanners}
      initialKind={initialKind}
      justCreated={just_created === '1'}
    />
  );
}
