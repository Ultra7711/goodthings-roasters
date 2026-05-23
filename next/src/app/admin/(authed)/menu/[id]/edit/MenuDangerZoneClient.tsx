'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MenuDangerZoneClient — /admin/menu/[id]/edit 위험 영역 (S244)

   ProductDangerZoneClient 답습 + cafe-menu 특화:
   - menu_likes orphan 경고 (047 FK 미박힘 — 좋아요 카운트는 그대로 잔존)
   - ConfirmModal variant='danger' + requireTextMatch=메뉴명
   - 성공 시 /admin/menu redirect
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/ui/button';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { describeError } from '@/lib/admin/errorDescribe';
import { deleteCafeMenuAction } from '../../actions';

type Props = {
  menuId: string;
  menuName: string;
  /** owner (관리자) 만 영구 삭제. staff 는 disabled. */
  isOwner: boolean;
};

export default function MenuDangerZoneClient({
  menuId,
  menuName,
  isOwner,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCafeMenuAction({ id: menuId });
      if (!result.ok) {
        toast.error(describeError(result.error, result.detail));
        return;
      }
      setOpen(false);
      toast.success('메뉴를 삭제했습니다');
      router.push('/admin/menu');
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
          메뉴를 영원히 삭제합니다. 업로드해 둔 이미지 파일도 함께 지워집니다.
          <br />
          <strong className="text-foreground">
            고객이 좋아요를 눌렀던 기록은 그대로 남아 있습니다
          </strong>
          {' '}— 좋아요 카운트는 다른 메뉴에 영향을 주지 않습니다.
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
          메뉴 영구 삭제
        </Button>
      </section>

      <ConfirmModal
        open={open}
        variant="danger"
        title="메뉴를 영구 삭제하시겠습니까?"
        description={
          <>
            이미지도 함께 사라지며, 되돌릴 수 없습니다.
            <br />
            고객 좋아요 기록은 그대로 남아 있어요.
          </>
        }
        requireTextMatch={menuName}
        requireTextLabel="확인을 위해 메뉴명을 정확히 입력해 주세요"
        confirmLabel="영구 삭제"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
