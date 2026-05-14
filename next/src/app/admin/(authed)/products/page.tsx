/* ══════════════════════════════════════════════════════════════════════════
   AdminProductsPage (서버 컴포넌트) — S218 Phase 1

   - listAdminProductsLite() 로 어드민 목록 행 조회 (is_active 무관)
   - 인터랙티브 영역은 ProductsTableClient 위임
   ══════════════════════════════════════════════════════════════════════════ */

import { listAdminProductsLite } from '@/lib/admin/productsServer';
import ProductsTableClient from './ProductsTableClient';

export default async function AdminProductsPage() {
  const rows = await listAdminProductsLite();
  return <ProductsTableClient rows={rows} />;
}
