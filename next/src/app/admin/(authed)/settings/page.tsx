/* ══════════════════════════════════════════
   AdminSettingsPage — server component (S129 H-2 · S237 시그니처 iframe 모델)

   fetchSiteSettings → <SettingsForm initialSettings={...} />.
   ══════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const [initialSettings, claims] = await Promise.all([
    fetchSiteSettings(),
    getAdminClaims(),
  ]);
  return (
    <SettingsForm
      initialSettings={initialSettings}
      isOwner={claims?.adminLevel === 'owner'}
    />
  );
}
