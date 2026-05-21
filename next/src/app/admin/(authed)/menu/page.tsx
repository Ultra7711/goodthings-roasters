/* ══════════════════════════════════════════════════════════════════════════
   AdminMenuPage (서버 컴포넌트) — S244

   - listAdminCafeMenuLite() 로 어드민 목록 행 조회 (is_active 무관)
   - 인터랙티브 영역은 MenuTableClient 위임
   - products/page.tsx 1:1 답습
   ══════════════════════════════════════════════════════════════════════════ */

import { listAdminCafeMenuLite } from '@/lib/admin/cafeMenuServer';
import MenuTableClient from './MenuTableClient';

export default async function AdminMenuPage() {
  const rows = await listAdminCafeMenuLite();
  return <MenuTableClient rows={rows} />;
}
