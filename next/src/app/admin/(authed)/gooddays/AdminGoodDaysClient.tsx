'use client';

/* ══════════════════════════════════════════════════════════════════════════
   AdminGoodDaysClient — /admin/gooddays 갤러리 운영 UI (S167 J-4)

   책임:
   - 그리드 목록 (썸네일 + alt + featured + is_active + 삭제 + 드래그)
   - 드래그 리오더 (@dnd-kit/sortable)
   - 업로드 다이얼로그 (file + alt + featured)
   - actions 4종 호출 + revalidate

   설계 (ADR-006 §적용 범위):
   - Server Action 단일 채널.
   - cafe-events/CafeEventsForm 답습 — useTransition · sonner toast · router.refresh.
   - 드래그 종료 시 즉시 reorder action 호출 (낙관 X, 일관성 우선).
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Trash2, Upload } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Switch } from '@/components/admin/ui/switch';
import { Label } from '@/components/admin/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';
import ConfirmModal from '@/components/admin/ConfirmModal';
/* S222 PR-5b: ADMIN_INPUT_STYLE / ADMIN_FILE_INPUT_STYLE / ADMIN_BTN_*
   상수 폐기 — shadcn Button / Input 직접 사용. */
import type { GoodDaysGalleryRow } from '@/lib/gooddaysServer';
import {
  deleteGoodDaysImageAction,
  reorderGoodDaysImagesAction,
  updateGoodDaysImageAction,
  uploadGoodDaysImageAction,
} from './actions';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Props {
  initialItems: GoodDaysGalleryRow[];
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function AdminGoodDaysClient({ initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<GoodDaysGalleryRow[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  /* dnd-kit 의 announcer ID (DndDescribedBy-N) 가 SSR vs CSR 별 카운터에서 발급되어
     hydration mismatch 발생. Grid 부분만 mounted 후에 render → SSR 시점 dnd-kit 회피.
     (S167 J-4 fix) */
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
  }, []);

  /* router.refresh() 후 server fetch 결과 (initialItems prop) → items state 동기화.
     mutation actions (upload/delete/reorder/update) 가 모두 router.refresh() 호출 →
     이 useEffect 가 stale state 덮어쓰기. (S167 J-4 fix) */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ── 드래그 종료 → reorder action ───────────────────────────────────── */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered); /* 낙관 UI */

    const orderedIds = reordered.map((it) => it.id);
    startTransition(async () => {
      const result = await reorderGoodDaysImagesAction({ orderedIds });
      if (!result.ok) {
        toast.error(describeMutationError('정렬을 저장', result.error, result.detail));
        setItems(items); /* 롤백 */
      } else {
        router.refresh();
      }
    });
  }

  /* ── 부분 업데이트 (alt/featured/isActive) ──────────────────────────── */
  function patchItem(id: string, patch: Partial<GoodDaysGalleryRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function commitUpdate(
    id: string,
    fields: { alt?: string; featured?: boolean; isActive?: boolean },
  ) {
    startTransition(async () => {
      const result = await updateGoodDaysImageAction({ id, ...fields });
      if (!result.ok) {
        toast.error(describeMutationError('변경사항을 저장', result.error, result.detail));
      }
    });
  }

  /* ── 삭제 ────────────────────────────────────────────────────────────── */
  function confirmDelete() {
    const id = deleteTargetId;
    if (!id) return;
    startTransition(async () => {
      const result = await deleteGoodDaysImageAction({ id });
      if (!result.ok) {
        toast.error(describeMutationError('삭제', result.error, result.detail));
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeleteTargetId(null);
      toast.success('이미지를 삭제했습니다');
      router.refresh();
    });
  }

  /* ── 업로드 ──────────────────────────────────────────────────────────── */
  async function handleUpload(formData: FormData) {
    /* Server Action 자체가 throw 하는 경우 (예: body 한도 초과 등 Next.js 단계 실패) 도
       graceful 처리 — UI 잠금 방지. */
    try {
      const result = await uploadGoodDaysImageAction(formData);
      if (!result.ok) {
        toast.error(describeMutationError('이미지를 업로드', result.error, result.detail));
        return false;
      }
      toast.success('이미지를 등록했습니다');
      router.refresh();
      return true;
    } catch {
      toast.error('이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return false;
    }
  }

  return (
    <>
      {/* ── 상단 sticky topbar 우측 actions slot ──────────────────────── */}
      {/* 시안 Button(size=sm) inline style — dashboard/cafe-events 답습.
         sm: padding 5/10, fontSize 12, height 28, gap 5, primary BG. */}
      <AdminTopbarActions>
        <Button
          type="button"
          size="sm"
          className="!h-7"
          onClick={() => setUploadOpen(true)}
          disabled={isPending}
        >
          <Upload size={14} />
          이미지 업로드
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="굿데이즈 갤러리"
        subtitle={
          <span className="leading-relaxed">
            {items.length}장 · 드래그로 순서 변경 · 토글로 활성/비활성
            <br />
            <span className="text-[var(--foreground-subtle)] inline-flex items-center gap-1">
              <Star size={11} fill="currentColor" className="text-[var(--primary)]" />
              Featured = 매거진 그리드 큰 사진 슬롯에 우선 배치
            </span>
          </span>
        }
      />

      {/* ── 그리드 ─────────────────────────────────────────────────────── */}
      {!mounted ? (
        <div aria-hidden className="px-6 py-16 text-center text-sm text-muted-foreground">
          로딩 중…
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg px-6 py-16 text-center text-sm text-muted-foreground">
          아직 등록된 이미지가 없습니다. 상단 "이미지 업로드" 로 시작하세요.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((it) => it.id)}
            strategy={rectSortingStrategy}
          >
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
            >
              {items.map((item) => (
                <SortableCard
                  key={item.id}
                  item={item}
                  disabled={isPending}
                  onAltChange={(alt) => patchItem(item.id, { alt })}
                  onAltCommit={(alt) => commitUpdate(item.id, { alt })}
                  onFeaturedToggle={(featured) => {
                    patchItem(item.id, { featured });
                    commitUpdate(item.id, { featured });
                  }}
                  onActiveToggle={(isActive) => {
                    patchItem(item.id, { isActive });
                    commitUpdate(item.id, { isActive });
                  }}
                  onDelete={() => setDeleteTargetId(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleUpload}
      />

      <ConfirmModal
        open={deleteTargetId !== null}
        variant="danger"
        title="이미지를 삭제하시겠습니까?"
        description="이 이미지는 영원히 사라지며, 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={isPending}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** 운영자 친화 에러 문구. action 은 동사 (예: '이미지를 업로드'). */
function describeMutationError(action: string, error: string, detail?: string): string {
  switch (error) {
    case 'unauthorized':
      return '권한이 없습니다. 다시 로그인해 주세요.';
    case 'not_found':
      return '이미지를 찾을 수 없어요 (이미 삭제됐을 수 있어요).';
    case 'invalid_image':
      return '이미지 파일을 읽을 수 없어요. 다른 파일로 시도해 주세요.';
    case 'validation_failed':
      if (detail === 'file_missing') return '파일을 선택해 주세요.';
      if (detail === 'file_too_large') return '파일이 너무 큽니다. 5MB 이하로 다시 시도해 주세요.';
      return '입력값을 확인해 주세요.';
    case 'server_error':
    default:
      return `${action}하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
  }
}

/* ── SortableCard ──────────────────────────────────────────────────────── */

interface CardProps {
  item: GoodDaysGalleryRow;
  disabled: boolean;
  onAltChange: (alt: string) => void;
  onAltCommit: (alt: string) => void;
  onFeaturedToggle: (featured: boolean) => void;
  onActiveToggle: (isActive: boolean) => void;
  onDelete: () => void;
}

function SortableCard({
  item,
  disabled,
  onAltChange,
  onAltCommit,
  onFeaturedToggle,
  onActiveToggle,
  onDelete,
}: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : item.isActive ? 1 : 0.55,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 썸네일 */}
      <div className="relative aspect-square">
        <Image
          src={item.src}
          alt={item.alt}
          fill
          sizes="220px"
          style={{ objectFit: 'cover' }}
          placeholder="blur"
          blurDataURL={item.blurDataURL}
        />
        {/* 드래그 핸들 — native button 이라 .gtr-admin reset 영향 받음 → !text-white 강제 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="드래그하여 순서 변경"
          className="absolute top-2 left-2 w-7 h-7 rounded-md bg-black/50 !text-white border-none flex items-center justify-center cursor-grab touch-none"
        >
          <GripVertical size={16} />
        </button>
        {item.featured && (
          <div
            aria-label="featured"
            title="Featured — 매거진 큰 사진 슬롯 우선 배치"
            className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/50 text-[var(--primary)] flex items-center justify-center"
          >
            <Star size={16} fill="currentColor" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* 컨트롤 */}
      <div className="p-3 flex flex-col gap-2">
        <Input
          value={item.alt}
          placeholder="대체 텍스트 (alt)"
          maxLength={200}
          disabled={disabled}
          onChange={(e) => onAltChange(e.target.value)}
          onBlur={(e) => onAltCommit(e.target.value)}
          className="!h-8"
        />
        <div className="flex items-center justify-between text-sm">
          <Label className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
            <Switch
              checked={item.featured}
              onCheckedChange={onFeaturedToggle}
              disabled={disabled}
              className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
            />
            Featured
          </Label>
          <Label className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
            <Switch
              checked={item.isActive}
              onCheckedChange={onActiveToggle}
              disabled={disabled}
              className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
            />
            활성
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!h-7 self-start !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 size={14} />
          삭제
        </Button>
      </div>
    </div>
  );
}

/* ── UploadDialog ─────────────────────────────────────────────────────── */

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<boolean>;
}

function UploadDialog({ open, onOpenChange, onSubmit }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [featured, setFeatured] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFile(null);
    setAlt('');
    setFeatured(false);
  }

  async function handleSubmit() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt', alt);
    fd.append('featured', featured ? 'true' : 'false');
    setSubmitting(true);
    let ok = false;
    try {
      ok = await onSubmit(fd);
    } finally {
      /* onSubmit 이 throw 해도 모달 버튼 잠김 해제 보장. */
      setSubmitting(false);
    }
    if (ok) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      {/* shadcn DialogContent 의 Tailwind p-6 가 admin 영역에서 적용되지 않는
         케이스 관찰됨 — inline style 로 padding·gap 명시 강제. (B-180b) */}
      <DialogContent style={{ padding: 24, gap: 16, maxWidth: 480 }}>
        <DialogHeader>
          <DialogTitle>이미지 업로드</DialogTitle>
          <DialogDescription>
            webp · avif · jpeg · png. 최대 5MB.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gd-upload-file" className="text-xs font-medium text-foreground">
              파일
            </Label>
            <Input
              id="gd-upload-file"
              type="file"
              accept="image/webp,image/avif,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
              className="file:mr-2 file:rounded-md file:border-0 file:bg-[var(--surface-muted)] file:px-2 file:py-1 file:text-xs file:text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gd-upload-alt" className="text-xs font-medium text-foreground">
              대체 텍스트 (alt)
            </Label>
            <Input
              id="gd-upload-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={200}
              placeholder="(선택) 스크린리더용 설명"
              disabled={submitting}
            />
          </div>
          <Label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <Switch
              checked={featured}
              onCheckedChange={setFeatured}
              disabled={submitting}
              className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
            />
            Featured = 매거진 그리드 큰 사진 슬롯에 우선 배치
          </Label>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!file || submitting}
          >
            {submitting ? '업로드 중…' : '업로드'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
