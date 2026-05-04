/* ══════════════════════════════════════════
   AdminCafeEventsPage — server component (S151 PR-2a)
   listCafeEventsAdmin → <CafeEventsForm initialEvents={...} />.
   ══════════════════════════════════════════ */

import { listCafeEventsAdmin } from '@/lib/cafeEventsServer';
import CafeEventsForm from './CafeEventsForm';

export default async function AdminCafeEventsPage() {
  const initialEvents = await listCafeEventsAdmin();
  return <CafeEventsForm initialEvents={initialEvents} />;
}
