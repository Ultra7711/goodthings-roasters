/* ══════════════════════════════════════════════════════════════════════════
   AdminProductNewPage — /admin/products/new (S231-2)

   - ProductEditForm 답습 (mode='create')
   - basic / detail / option 3탭 RHF + zod
   - slug 자동 생성 (name 의 영문 부분 → kebab-case · 운영자 수동 수정 가능)
   - sortOrder 자동 (같은 카테고리 max + 1 · readonly)
   - 등록 성공 시 /admin/products/{slug}/edit redirect → 이미지 업로드 (S231-3)
   - 이미지 갤러리 섹션은 edit 페이지에 두기 — 등록 직후에는 빈 상태 안내

   carry-over:
   - S231-3 이미지 Storage 업로드 (sharp + plaiceholder)
   - S231-4 createProductAction 트랜잭션 RPC 보강
   - /admin/products 목록 reorder UI (A-1 화살표 버튼 · 별 sprint)
   ══════════════════════════════════════════════════════════════════════════ */

import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { fetchAdminNextSortOrder } from '@/lib/admin/productsServer';
import ProductEditForm from '../[slug]/edit/ProductEditForm';
import { PdpDirtyProvider } from '../[slug]/edit/PdpDirtyContext';

export default async function AdminProductNewPage() {
  /* create_product RPC (마이그 051) 내부에서 카테고리 max+1 재계산하므로
     client prefetch 값은 표시용. coffee_bean 기본 prefetch — drip_bag 선택 시
     서버에서 정확한 값으로 최종 갱신. */
  const initialSortOrder = await fetchAdminNextSortOrder('coffee_bean');

  /* S251 Phase 3b — ProductEditForm 의 usePdpDirty 호출 보호용 빈 Provider.
     신규 등록 시점엔 이미지가 없으므로 imageOrderDirty 항상 false. */
  return (
    <PdpDirtyProvider initialImageOrder={[]}>
      <div>
        <AdminBackLink href="/admin/products" label="상품 목록으로" />

        <div className="mb-6">
          <h2 className="m-0 text-2xl font-medium tracking-tight">신규 상품 등록</h2>
          <div className="mt-1 text-sm text-muted-foreground">
            기본 정보 · 상세 · 옵션을 채우고 등록하면 이미지 업로드 단계로 이동합니다.
          </div>
        </div>

        <ProductEditForm mode="create" initialSortOrder={initialSortOrder} />
      </div>
    </PdpDirtyProvider>
  );
}
