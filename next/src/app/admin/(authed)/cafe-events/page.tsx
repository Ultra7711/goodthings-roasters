/* ══════════════════════════════════════════
   AdminCafeEventsPage — server component (S151 PR-2a · S270 Phase 3b)
   listBannersAdmin('cafe_event') → <CafeEventsForm initialEvents={...} />.
   ══════════════════════════════════════════ */

import { listBannersAdmin } from '@/lib/admin/bannersServer';
import type { CafeEventBanner } from '@/lib/banners';
import CafeEventsForm from './CafeEventsForm';

export default async function AdminCafeEventsPage() {
  /* banners 통합 테이블 (071) 에서 kind='cafe_event' 만 fetch.
     discriminated union → 호출부에서 type narrowing 위해 cast. */
  const banners = await listBannersAdmin('cafe_event');
  const initialEvents = banners.filter(
    (b): b is CafeEventBanner => b.kind === 'cafe_event',
  );
  return <CafeEventsForm initialEvents={initialEvents} />;
}
