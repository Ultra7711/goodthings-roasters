/* ══════════════════════════════════════════
   AdminSettingsPage — server component (S129 H-2 · S237 시그니처 iframe 모델 · S248 메인 노출 메뉴)

   fetchSiteSettings + fetchCafeMenu → <SettingsForm initialSettings={...} cafeMenus={...} />.
   ══════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchCafeMenu } from '@/lib/cafeMenuServer';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const [initialSettings, claims, cafeMenus] = await Promise.all([
    fetchSiteSettings(),
    getAdminClaims(),
    fetchCafeMenu(),
  ]);
  return (
    <SettingsForm
      initialSettings={initialSettings}
      isOwner={claims?.adminLevel === 'owner'}
      cafeMenus={cafeMenus}
    />
  );
}
