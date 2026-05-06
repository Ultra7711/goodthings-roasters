/* ══════════════════════════════════════════
   AdminGoodDaysPage — server component (S167 J-4)
   listGoodDaysGalleryAdmin → <AdminGoodDaysClient initialItems={...} />.
   ══════════════════════════════════════════ */

import { listGoodDaysGalleryAdmin } from '@/lib/gooddaysServer';
import AdminGoodDaysClient from './AdminGoodDaysClient';

export default async function AdminGoodDaysPage() {
  const initialItems = await listGoodDaysGalleryAdmin();
  return <AdminGoodDaysClient initialItems={initialItems} />;
}
