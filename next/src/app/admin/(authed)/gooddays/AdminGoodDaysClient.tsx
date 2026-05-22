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

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
import { GripVertical, Pencil, Star, Trash2, Upload } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
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
  /* 옵션 C — 미리보기 + 저장 버튼 패턴 (S250-6 #2).
     - items: UI 표시 (DnD drag-end 시 즉시 swap, server 호출 X)
     - originalItems: 마지막 저장 상태 (dirty 비교 + 변경 취소 기준)
     - 변경사항 적용 = reorderGoodDaysImagesAction
     - 변경 취소 = items ← originalItems (즉시)
     - alt/featured/isActive 패치 / 업로드 / 삭제 = 즉시 저장 유지 (단일 결정)
     답습: ProductsTableClient / MenuTableClient / ProductImageReorderClient 옵션 C */
  const [items, setItems] = useState<GoodDaysGalleryRow[]>(initialItems);
  const [originalItems, setOriginalItems] =
    useState<GoodDaysGalleryRow[]>(initialItems);
  const [isPending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [altEditTarget, setAltEditTarget] = useState<
    { id: string; alt: string } | null
  >(null);

  /* dnd-kit 의 announcer ID (DndDescribedBy-N) 가 SSR vs CSR 별 카운터에서 발급되어
     hydration mismatch 발생. Grid 부분만 mounted 후에 render → SSR 시점 dnd-kit 회피.
     (S167 J-4 fix) */
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
  }, []);

  /* router.refresh() 후 server fetch 결과 (initialItems prop) → state 동기화.
     mutation actions (upload/delete/update) 가 모두 router.refresh() 호출.
     dirty (reorder 순서 다름) 인 경우 items 의 id 순서 보존, 다른 필드는 새 props. */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setOriginalItems(initialItems);
    setItems((prev) => {
      const sameLength = prev.length === initialItems.length;
      const prevIds = prev.map((i) => i.id).join(',');
      const newIds = initialItems.map((i) => i.id).join(',');
      const wasDirty = sameLength && prevIds !== newIds;
      if (!wasDirty) return initialItems;
      const initMap = new Map(initialItems.map((i) => [i.id, i]));
      return prev.map((p) => initMap.get(p.id) ?? p).filter((i) => initMap.has(i.id));
    });
  }, [initialItems]);

  const isOrderDirty = useMemo(() => {
    const origIds = originalItems.map((i) => i.id).join(',');
    const currIds = items.map((i) => i.id).join(',');
    return origIds !== currIds;
  }, [items, originalItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ── 드래그 종료 → 미리보기 swap (옵션 C · server 호출 X) ───────────── */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    setItems(arrayMove(items, oldIdx, newIdx));
  }

  /* "변경사항 적용" — 현재 순서를 server 호출 */
  function handleSaveOrder() {
    if (!isOrderDirty) return;
    const orderedIds = items.map((it) => it.id);
    startTransition(async () => {
      const result = await reorderGoodDaysImagesAction({ orderedIds });
      if (!result.ok) {
        toast.error(describeMutationError('정렬을 저장', result.error, result.detail));
        return;
      }
      toast.success('이미지 순서를 저장했습니다');
      setOriginalItems(items); // snapshot 갱신
      router.refresh();
    });
  }

  /* "변경 취소" — 즉시 items ← originalItems */
  function handleCancelOrder() {
    setItems(originalItems);
  }

  /* ── 부분 업데이트 (alt/featured/isActive) — 즉시 저장 유지 ─────────── */
  function patchItem(id: string, patch: Partial<GoodDaysGalleryRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    /* originalItems 도 동기 갱신 — dirty 와 분리 (reorder 순서 보존 / 변경 취소 시
       이 patch 가 사라지지 않도록) */
    setOriginalItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
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

  /* ── alt 편집 모달 저장 ──────────────────────────────────────────────── */
  function handleAltSave(alt: string) {
    if (!altEditTarget) return;
    const id = altEditTarget.id;
    patchItem(id, { alt });
    commitUpdate(id, { alt });
    setAltEditTarget(null);
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
      /* originalItems 도 동기 제거 — dirty 와 분리 */
      setOriginalItems((prev) => prev.filter((it) => it.id !== id));
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
        {isOrderDirty ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7"
              onClick={handleCancelOrder}
              disabled={isPending}
            >
              변경 취소
            </Button>
            <Button
              type="button"
              size="sm"
              className="!h-7"
              onClick={handleSaveOrder}
              disabled={isPending}
            >
              {isPending ? '적용 중…' : '변경사항 적용'}
            </Button>
          </>
        ) : (
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
        )}
      </AdminTopbarActions>

      <AdminPageHeader
        title="굿데이즈 갤러리"
        subtitle={
          <span className="leading-relaxed">
            {items.length}장 · 드래그로 순서 변경 · 공개 토글로 사이트 노출 제어
            <br />
            <span className="text-[var(--foreground-subtle)] inline-flex items-center gap-1">
              <Star size={11} fill="currentColor" className="text-[var(--primary)]" />
              추천 = 매거진 그리드 큰 사진 슬롯에 우선 배치
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
        <AdminEmptyState
          variant="card"
          message="아직 등록된 이미지가 없습니다."
          action={
            <Button
              type="button"
              size="sm"
              className="!h-8"
              onClick={() => setUploadOpen(true)}
              disabled={isPending}
            >
              <Upload size={14} />
              이미지 업로드
            </Button>
          }
        />
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
                  onEditAlt={() => setAltEditTarget({ id: item.id, alt: item.alt })}
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

      <EditAltDialog
        open={altEditTarget !== null}
        initialAlt={altEditTarget?.alt ?? ''}
        pending={isPending}
        onCancel={() => setAltEditTarget(null)}
        onSave={handleAltSave}
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
  onEditAlt: () => void;
  onFeaturedToggle: (featured: boolean) => void;
  onActiveToggle: (isActive: boolean) => void;
  onDelete: () => void;
}

function SortableCard({
  item,
  disabled,
  onEditAlt,
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
          <span
            aria-label="추천 이미지"
            title="추천 - 매거진 큰 사진 슬롯 우선 배치"
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)] !text-white text-xs font-semibold"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
          >
            <Star size={11} fill="currentColor" strokeWidth={1.5} />
            추천
          </span>
        )}
        {/* 비공개 배지 — 안전장치 (products 답습) · 좌하단 */}
        {!item.isActive && (
          <span
            aria-label="비공개 이미지"
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neutral-soft)] text-[var(--neutral-soft-fg)] text-xs font-semibold"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
          >
            비공개
          </span>
        )}
      </div>

      {/* 컨트롤 — 2 행 구조 (좌 토글 / 우 액션 · justify-between)
         행 1 = 공개 토글 + 대체 텍스트 편집
         행 2 = 추천 토글 + 삭제 */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={item.isActive}
              onCheckedChange={onActiveToggle}
              disabled={disabled}
              aria-label={item.isActive ? '사이트 노출 중 — 비공개로 전환' : '비공개 — 사이트에 노출'}
              className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
            />
            <span className="text-muted-foreground">
              {item.isActive ? '공개' : '비공개'}
            </span>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 !text-xs !px-2"
            onClick={onEditAlt}
            disabled={disabled}
            aria-label="대체 텍스트 편집"
          >
            <Pencil size={14} />
            대체 텍스트
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={item.featured}
              onCheckedChange={onFeaturedToggle}
              disabled={disabled}
              aria-label={item.featured ? '추천 — 해제하기' : '추천으로 설정'}
              className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
            />
            <span className="text-muted-foreground">
              {item.featured ? '추천' : '추천 해제'}
            </span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)] !text-xs !px-2"
            onClick={onDelete}
            disabled={disabled}
            aria-label="이미지 삭제"
          >
            <Trash2 size={14} />
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── EditAltDialog ────────────────────────────────────────────────────── */

interface EditAltDialogProps {
  open: boolean;
  initialAlt: string;
  pending: boolean;
  onCancel: () => void;
  onSave: (alt: string) => void;
}

function EditAltDialog({
  open,
  initialAlt,
  pending,
  onCancel,
  onSave,
}: EditAltDialogProps) {
  const [alt, setAlt] = useState(initialAlt);

  /* 모달 열릴 때마다 initialAlt 로 재초기화 */
  useEffect(() => {
    if (open) setAlt(initialAlt);
  }, [open, initialAlt]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[480px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-0 text-left">
          <DialogTitle className="text-base font-medium">대체 텍스트 편집</DialogTitle>
          <DialogDescription className="text-xs mt-1">
            스크린리더 사용자에게 읽어줄 이미지 설명 (선택)
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={200}
            placeholder="예: 매장 전경 — 따뜻한 조명 아래 손님 두 분"
            autoFocus
            disabled={pending}
          />
        </div>
        <DialogFooter className="px-6 pb-5 sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-8 min-w-[96px]"
            onClick={onCancel}
            disabled={pending}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            className="!h-8 min-w-[96px]"
            onClick={() => onSave(alt)}
            disabled={pending}
          >
            {pending ? '저장 중…' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFile(null);
    setAlt('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt', alt);
    /* S234: '추천' 토글 폐기 — 업로드 후 카드에서 토글로 설정.
       server action 의 featured = formData.get('featured') === 'true'
       → 미전송 시 false default · backward compat OK. */
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
      {/* admin-design §5-12 Dialog 답습 — p-0 gap-0 + 영역별 padding 토큰 */}
      <DialogContent showCloseButton className="max-w-[480px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-0 text-left">
          <DialogTitle className="text-base font-medium">이미지 업로드</DialogTitle>
          <DialogDescription className="text-xs mt-1">
            굿데이즈 갤러리에 새 이미지를 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">파일</Label>
            {/* ProductImageReorderClient 답습 — hidden input + Button trigger.
               파일명 + helper 한 줄 (버튼 밑 별도 행 없음). */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <Upload size={14} />
                파일 선택
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/webp,image/avif,image/jpeg,image/png"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                {file ? file.name : '선택된 파일 없음 · 5MB 이하 · webp · avif · jpeg · png'}
              </span>
            </div>
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
        </div>
        <DialogFooter className="px-6 pb-5 sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-8 min-w-[96px]"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            className="!h-8 min-w-[96px]"
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
