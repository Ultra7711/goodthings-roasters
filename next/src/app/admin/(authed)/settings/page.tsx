/* ══════════════════════════════════════════
   AdminSettingsPage — server component (S129 H-2)
   fetchSiteSettings → <SettingsForm initialSettings={...} />.
   ══════════════════════════════════════════ */

import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import { listProductsAdmin } from '@/lib/admin/productsServer';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const [initialSettings, allProducts] = await Promise.all([
    fetchSiteSettings(),
    listProductsAdmin(),
  ]);
  const coffeeBeans = allProducts.filter((p) => p.category === 'Coffee Bean');
  return <SettingsForm initialSettings={initialSettings} coffeeBeans={coffeeBeans} />;
}
