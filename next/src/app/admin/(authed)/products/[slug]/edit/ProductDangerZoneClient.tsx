'use client';

/* ══════════════════════════════════════════════════════════════════════════
   ProductDangerZoneClient — /admin/products/[slug]/edit 위험 영역 (S231-4)

   책임:
   - 상품 영구 삭제 (deleteProductAction)
   - admin ConfirmModal — variant='danger' + requireTextMatch=상품명 (강한 확인)
   - 성공 시 /admin/products 로 redirect

   주의:
   - DB cascade (volumes / images / recipes) + Storage 폴더 cleanup
   - cart_items / subscriptions 의 product_slug 스냅샷은 그대로 보존 (FK 없음)
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { deleteProductAction } from '../../productActions';

type Props = {
  productId: string;
  productName: string;
  /** S232: owner (관리자) 만 영구 삭제 가능. staff (운영자) 는 disabled. */
  isOwner: boolean;
};

export default function ProductDangerZoneClient({
  productId,
  productName,
  isOwner,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteProductAction({ id: productId });
      if (!result.ok) {
        const msg =
          result.error === 'unauthorized'
            ? '권한이 없습니다. 다시 로그인해 주세요.'
            : result.error === 'not_found'
              ? '상품을 찾을 수 없습니다.'
              : '삭제 중 오류가 발생했습니다.';
        toast.error(msg);
        return;
      }
      setOpen(false);
      toast.success('상품을 삭제했습니다');
      router.push('/admin/products');
    });
  }

  return (
    <>
      <section
        className="bg-card border rounded-lg p-5 mt-5"
        style={{ borderColor: 'var(--danger)' }}
      >
        <h3 className="m-0 mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--danger)]">
          위험 영역
        </h3>
        <div className="text-xs text-muted-foreground leading-relaxed mb-4">
          상품을 영원히 삭제합니다. 이 상품의 이미지 · 옵션 · 레시피도 함께 사라지며,
          업로드해 둔 이미지 파일도 모두 지워집니다.
          <br />
          <strong className="text-foreground">고객이 이미 주문하거나 정기배송 중인 기록은 그대로 남아 있습니다</strong> —
          상품을 지워도 과거 주문서는 그대로 조회됩니다.
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-8 !text-[var(--danger)] !border-[var(--danger)] hover:!bg-[var(--danger-soft)]"
          onClick={() => setOpen(true)}
          disabled={!isOwner || pending}
          title={!isOwner ? '관리자 권한 필요' : undefined}
        >
          <Trash2 size={14} />
          상품 영구 삭제
        </Button>
      </section>

      <ConfirmModal
        open={open}
        variant="danger"
        title="상품을 영구 삭제하시겠습니까?"
        description={
          <>
            이미지 · 옵션 · 레시피도 함께 사라지며, 되돌릴 수 없습니다.
            <br />
            과거 주문 · 정기배송 기록은 그대로 남아 있어요.
          </>
        }
        requireTextMatch={productName}
        requireTextLabel="확인을 위해 상품명을 정확히 입력해 주세요"
        confirmLabel="영구 삭제"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
