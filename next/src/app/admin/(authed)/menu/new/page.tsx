/* ══════════════════════════════════════════════════════════════════════════
   AdminMenuNewPage — /admin/menu/new (S244)

   - MenuEditForm 답습 (mode='create')
   - basic / nutrition 2탭 RHF + zod
   - ID 는 server action 이 카테고리/시그니처 prefix 자동 결정 + 번호 채번
   - sortOrder 는 전체 max+1 prefetch (S245-P9 정정 · cafe-menu seed 가
     전체 단일 시퀀스 = idx 기반 · 카테고리 무관)
   - 등록 성공 시 /admin/menu/{id}/edit redirect → 이미지 업로드 단계
   ══════════════════════════════════════════════════════════════════════════ */

import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { fetchAdminNextCafeMenuSortOrder } from '@/lib/admin/cafeMenuServer';
import MenuEditForm from '../[id]/edit/MenuEditForm';

export default async function AdminMenuNewPage() {
  const initialSortOrder = await fetchAdminNextCafeMenuSortOrder();

  return (
    <div>
      <AdminBackLink href="/admin/menu" label="카페 메뉴 목록으로" />

      <div className="mb-6">
        <h2 className="m-0 text-2xl font-medium tracking-tight">신규 메뉴 등록</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          기본 정보 · 영양 정보를 채우고 등록하면 이미지 업로드 단계로 이동합니다.
          ID 는 카테고리/시그니처에 따라 자동 생성됩니다.
        </div>
      </div>

      <MenuEditForm mode="create" initialSortOrder={initialSortOrder} />
    </div>
  );
}
