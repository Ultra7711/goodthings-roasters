/* ══════════════════════════════════════════
   AdminBannersPage — server component (S273 통합)
   - 두 kind (cafe_event · signature) 모두 fetch
   - BannerListClient 가 kind 탭 + 카드 grid + 화살표 reorder 담당
   ══════════════════════════════════════════ */

import { listBannersAdmin } from '@/lib/admin/bannersServer';
import BannerListClient from './BannerListClient';

export default async function AdminBannersPage() {
  const [cafeBanners, signatureBanners] = await Promise.all([
    listBannersAdmin('cafe_event'),
    listBannersAdmin('signature'),
  ]);

  return (
    <BannerListClient
      initialCafeBanners={cafeBanners}
      initialSignatureBanners={signatureBanners}
    />
  );
}
