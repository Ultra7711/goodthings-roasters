/* ══════════════════════════════════════════
   AdminSettingsPage — server component (S129 H-2)
   fetchSiteSettings → <SettingsForm initialSettings={...} />.
   ══════════════════════════════════════════ */

import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import SettingsForm from './SettingsForm';

export default async function AdminSettingsPage() {
  const initialSettings = await fetchSiteSettings();
  return <SettingsForm initialSettings={initialSettings} />;
}
