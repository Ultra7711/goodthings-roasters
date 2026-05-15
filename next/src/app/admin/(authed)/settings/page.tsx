/* ══════════════════════════════════════════
   AdminSettingsPage — server component (S129 H-2)
   fetchSiteSettings → <SettingsForm initialSettings={...} />.
   ══════════════════════════════════════════ */

import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import { listProductsAdmin } from '@/lib/admin/productsServer';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const [initialSettings, allProducts, claims] = await Promise.all([
    fetchSiteSettings(),
    listProductsAdmin(),
    getAdminClaims(),
  ]);
  const coffeeBeans = allProducts.filter((p) => p.category === 'Coffee Bean');
  return (
    <SettingsForm
      initialSettings={initialSettings}
      coffeeBeans={coffeeBeans}
      isOwner={claims?.adminLevel === 'owner'}
    />
  );
}
