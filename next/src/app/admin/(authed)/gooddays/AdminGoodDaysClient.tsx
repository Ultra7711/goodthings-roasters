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
        toast.error(`정렬 저장 실패 (${result.detail ?? result.error})`);
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
        toast.error(`수정 실패 (${result.detail ?? result.error})`);
      }
    });
  }

  /* ── 삭제 ────────────────────────────────────────────────────────────── */
  function handleDelete(id: string) {
    if (!confirm('이 이미지를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
    startTransition(async () => {
      const result = await deleteGoodDaysImageAction({ id });
      if (!result.ok) {
        toast.error(`삭제 실패 (${result.detail ?? result.error})`);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success('삭제 완료');
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
        toast.error(`업로드 실패 (${result.detail ?? result.error})`);
        return false;
      }
      toast.success('업로드 완료');
      router.refresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      toast.error(`업로드 실패 (${message.slice(0, 100)})`);
      return false;
    }
  }

  return (
    <div>
      {/* ── 헤더 ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            굿데이즈 갤러리
          </h2>
          <div
            style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}
          >
            {items.length}장 · 드래그로 순서 변경 · 토글로 활성/비활성
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={isPending}>
          <Upload size={16} style={{ marginRight: 6 }} />
          이미지 업로드
        </Button>
      </div>

      {/* ── 그리드 ─────────────────────────────────────────────────────── */}
      {!mounted ? (
        <div
          aria-hidden
          style={{
            padding: '64px 24px',
            textAlign: 'center',
            color: 'var(--foreground-muted)',
            fontSize: 14,
          }}
        >
          로딩 중…
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: '64px 24px',
            textAlign: 'center',
            color: 'var(--foreground-muted)',
            fontSize: 14,
          }}
        >
          아직 등록된 이미지가 없습니다. 우측 상단 "이미지 업로드" 로 시작하세요.
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
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
              }}
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
                  onDelete={() => handleDelete(item.id)}
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
    </div>
  );
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
      <div style={{ position: 'relative', aspectRatio: '1 / 1' }}>
        <Image
          src={item.src}
          alt={item.alt}
          fill
          sizes="220px"
          style={{ objectFit: 'cover' }}
          placeholder="blur"
          blurDataURL={item.blurDataURL}
        />
        {/* 드래그 핸들 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="드래그하여 순서 변경"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <GripVertical size={16} />
        </button>
        {item.featured && (
          <div
            aria-label="featured"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Star size={14} fill="currentColor" />
          </div>
        )}
      </div>

      {/* 컨트롤 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input
          value={item.alt}
          placeholder="대체 텍스트 (alt)"
          maxLength={200}
          disabled={disabled}
          onChange={(e) => onAltChange(e.target.value)}
          onBlur={(e) => onAltCommit(e.target.value)}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
          }}
        >
          <Label
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Switch
              checked={item.featured}
              onCheckedChange={onFeaturedToggle}
              disabled={disabled}
            />
            Featured
          </Label>
          <Label
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Switch
              checked={item.isActive}
              onCheckedChange={onActiveToggle}
              disabled={disabled}
            />
            활성
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={disabled}
          style={{ color: 'var(--destructive)', justifyContent: 'flex-start' }}
        >
          <Trash2 size={14} style={{ marginRight: 6 }} />
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>이미지 업로드</DialogTitle>
          <DialogDescription>
            webp · avif · jpeg · png. 최대 5MB.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label htmlFor="gd-upload-file">파일</Label>
            <Input
              id="gd-upload-file"
              type="file"
              accept="image/webp,image/avif,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={submitting}
            />
          </div>
          <div>
            <Label htmlFor="gd-upload-alt">대체 텍스트 (alt)</Label>
            <Input
              id="gd-upload-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={200}
              placeholder="(선택) 스크린리더용 설명"
              disabled={submitting}
            />
          </div>
          <Label
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Switch
              checked={featured}
              onCheckedChange={setFeatured}
              disabled={submitting}
            />
            Featured (매거진 span 슬롯 우선 배치)
          </Label>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitting}>
            {submitting ? '업로드 중...' : '업로드'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
