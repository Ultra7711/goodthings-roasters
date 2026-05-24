'use client';

/* ══════════════════════════════════════════════════════════════════════════
   BannerListClient — /admin/banners list + 화살표 reorder (S273 통합)

   책임:
   - kind 탭 (카페 / 시그니처) 전환
   - 카드 grid (sort_order ASC · 1번 = ★ 노출 배지)
   - 화살표 [←][노출로][→] = 즉시 sort_order 일괄 commit
   - 활성 토글 (updateBannerAction · enabled 만 변경)
   - 삭제 (deleteBannerAction · ConfirmModal)
   - 신규 등록 → /admin/banners/new?kind=...
   - 카드 클릭 → /admin/banners/[id]/edit

   답습:
   - ProductImageReorderClient.tsx — moveUp/moveDown/moveToFront + 순서 배지 + ★ 배지
   - admin-design.md — Button / Switch / ConfirmModal 토큰
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Switch } from '@/components/admin/ui/switch';
import ConfirmModal from '@/components/admin/ConfirmModal';
import { cn } from '@/lib/utils';
import { describeError } from '@/lib/admin/errorDescribe';
import type { Banner, BannerKind } from '@/lib/banners';
import {
  deleteBannerAction,
  reorderBannersAction,
  updateBannerAction,
} from './actions';

interface BannerListClientProps {
  initialCafeBanners: Banner[];
  initialSignatureBanners: Banner[];
  initialKind?: BannerKind;
  justCreated?: boolean;
}

const KIND_TABS: ReadonlyArray<{ key: BannerKind; label: string }> = [
  { key: 'cafe_event', label: '카페' },
  { key: 'signature', label: '시그니처' },
];

export default function BannerListClient({
  initialCafeBanners,
  initialSignatureBanners,
  initialKind = 'cafe_event',
  justCreated = false,
}: BannerListClientProps) {
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<BannerKind>(initialKind);
  const [cafeBanners, setCafeBanners] = useState<Banner[]>(initialCafeBanners);
  const [signatureBanners, setSignatureBanners] = useState<Banner[]>(
    initialSignatureBanners,
  );
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);

  /* server props 변경 시 client state 동기화 — 신규 등록 후 redirect 로 진입
     시 server fetch 가 새 banner row 포함된 array reference 전달. mount 시
     useState 초기값은 첫 reference 만 박힘 → 별도 동기화 필요 (S273-11). */
  useEffect(() => {
    setCafeBanners(initialCafeBanners);
  }, [initialCafeBanners]);
  useEffect(() => {
    setSignatureBanners(initialSignatureBanners);
  }, [initialSignatureBanners]);

  /* 신규 등록 후 server-side redirect 로 진입한 경우 toast + URL clean.
     createBannerAction 의 redirect 가 ?just_created=1 박음. strict mode dev
     double-invocation 회피 위해 useRef 가드. */
  const justCreatedShownRef = useRef(false);
  useEffect(() => {
    if (justCreated && !justCreatedShownRef.current) {
      justCreatedShownRef.current = true;
      toast.success('배너를 등록했습니다');
      router.replace(`/admin/banners?kind=${initialKind}`);
    }
  }, [justCreated, initialKind, router]);

  const currentBanners = activeKind === 'cafe_event' ? cafeBanners : signatureBanners;
  const setCurrentBanners =
    activeKind === 'cafe_event' ? setCafeBanners : setSignatureBanners;

  /* sort_order ASC → tie-break id ASC (selectActiveBanner 와 동일 룰). */
  const sortedBanners = useMemo<Banner[]>(() => {
    return [...currentBanners].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.id < b.id ? -1 : 1;
    });
  }, [currentBanners]);

  /* sort_order 일괄 commit. orderedIds 의 index → sort_order 값. */
  function applyReorder(newOrderedIds: string[]) {
    /* optimistic — 클라이언트 state 즉시 갱신 후 server commit. */
    const idToBanner = new Map(currentBanners.map((b) => [b.id, b]));
    const newBanners = newOrderedIds
      .map((id, idx) => {
        const b = idToBanner.get(id);
        return b ? { ...b, sort_order: idx } : null;
      })
      .filter((b): b is Banner => b !== null);
    setCurrentBanners(newBanners);

    startTransition(async () => {
      const result = await reorderBannersAction({
        kind: activeKind,
        orderedIds: newOrderedIds,
      });
      if (!result.ok) {
        toast.error(describeError(result.error, result.detail));
        /* rollback */
        setCurrentBanners(
          activeKind === 'cafe_event' ? initialCafeBanners : initialSignatureBanners,
        );
        return;
      }
      router.refresh();
    });
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const ids = sortedBanners.map((b) => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx]!, ids[idx - 1]!];
    applyReorder(ids);
  }

  function moveDown(idx: number) {
    if (idx === sortedBanners.length - 1) return;
    const ids = sortedBanners.map((b) => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1]!, ids[idx]!];
    applyReorder(ids);
  }

  function moveToFront(idx: number) {
    if (idx === 0) return;
    const ids = sortedBanners.map((b) => b.id);
    const [item] = ids.splice(idx, 1);
    if (item) ids.unshift(item);
    applyReorder(ids);
  }

  function handleToggleActive(banner: Banner) {
    const prev = currentBanners;
    const next = currentBanners.map((b) =>
      b.id === banner.id ? { ...b, enabled: !b.enabled } : b,
    );
    setCurrentBanners(next);

    startTransition(async () => {
      const result = await updateBannerAction({
        ...banner,
        enabled: !banner.enabled,
      });
      if (!result.ok) {
        setCurrentBanners(prev);
        toast.error(describeError(result.error, result.detail));
        return;
      }
      toast.success(
        !banner.enabled ? '배너를 공개했습니다' : '배너를 비공개로 전환했습니다',
      );
      router.refresh();
    });
  }

  function handleDeleteConfirm() {
    const target = deleteTarget;
    if (!target) return;

    const prev = currentBanners;
    const next = currentBanners.filter((b) => b.id !== target.id);
    setCurrentBanners(next);

    startTransition(async () => {
      const result = await deleteBannerAction({ id: target.id, kind: target.kind });
      if (!result.ok) {
        setCurrentBanners(prev);
        toast.error(describeError(result.error, result.detail));
        setDeleteTarget(null);
        return;
      }
      toast.success('배너를 삭제했습니다');
      setDeleteTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* 상단 topbar 우측 actions 슬롯 — menu/products list 답습 (S273-12). */}
      <AdminTopbarActions>
        <Button asChild size="sm" className="!h-7">
          <Link href={`/admin/banners/new?kind=${activeKind}`}>
            <Plus size={14} />
            신규 등록
          </Link>
        </Button>
      </AdminTopbarActions>

      <div className="flex flex-col gap-4 p-4">
        {/* kind 탭 */}
        <div
          role="tablist"
          aria-label="배너 종류"
          className="inline-flex items-center gap-1 p-1 rounded-md bg-muted self-start"
        >
          {KIND_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeKind === tab.key}
              onClick={() => setActiveKind(tab.key)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                activeKind === tab.key
                  ? 'bg-[var(--surface)] !text-foreground shadow-sm'
                  : 'text-muted-foreground hover:!text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {sortedBanners.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-muted-foreground bg-muted rounded-md border border-dashed border-border">
          등록된 배너가 없습니다. 우측 상단 "신규 등록" 버튼으로 추가해 주세요.
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            1번 카드 (★) 가 사이트에 노출되는 배너입니다. 화살표로 순서를 변경하면 즉시 반영됩니다.
          </div>
          <div
            className={cn(
              'grid gap-3 transition-opacity duration-150 ease',
              pending ? 'opacity-70' : 'opacity-100',
            )}
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {sortedBanners.map((banner, idx) => {
              const isFeatured = idx === 0;
              const canMoveUp = idx > 0;
              const canMoveDown = idx < sortedBanners.length - 1;
              const thumbSrc = banner.image_path_desktop;
              const blurSrc = banner.image_blur_desktop;
              const label =
                banner.internal_label.trim() ||
                banner.image_alt.trim() ||
                banner.headline_text.trim() ||
                '(이름 없음)';
              const period = formatPeriod(banner.start_date, banner.end_date);

              return (
                <div
                  key={banner.id}
                  className={cn(
                    'rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)] relative',
                    isFeatured
                      ? 'border-2 border-[var(--primary)]'
                      : 'border border-border',
                    !banner.enabled && 'opacity-70',
                  )}
                >
                  {/* 썸네일 — 카드 클릭 시 edit 페이지 진입 */}
                  <Link
                    href={`/admin/banners/${banner.id}/edit`}
                    className="block relative w-full aspect-[16/9] bg-[var(--placeholder-pattern-1)]"
                    style={{
                      background:
                        'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 5px, var(--placeholder-pattern-2) 5px 10px)',
                    }}
                    title="편집"
                  >
                    {thumbSrc ? (
                      <Image
                        src={thumbSrc}
                        alt=""
                        fill
                        sizes="220px"
                        style={{ objectFit: 'cover' }}
                        placeholder={blurSrc ? 'blur' : 'empty'}
                        blurDataURL={blurSrc || undefined}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        이미지 없음
                      </div>
                    )}
                    {/* 노출 배지 — 1번 카드만 */}
                    {isFeatured && (
                      <span
                        className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--primary)] !text-white text-xs font-semibold"
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                      >
                        <Star size={11} fill="currentColor" />
                        노출
                      </span>
                    )}
                    {/* 비공개 배지 */}
                    {!banner.enabled && (
                      <span
                        className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neutral-soft)] text-[var(--neutral-soft-fg)] text-xs font-semibold"
                        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                      >
                        비공개
                      </span>
                    )}
                    {/* 순서 배지 */}
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-black/55 !text-white text-xs font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                  </Link>

                  {/* 메타 — 카드 클릭 시 edit */}
                  <Link
                    href={`/admin/banners/${banner.id}/edit`}
                    className="block px-2.5 pt-2.5 pb-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className="text-sm font-medium truncate"
                      title={label}
                    >
                      {label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {period}
                    </div>
                  </Link>

                  {/* 액션 영역 */}
                  <div className="px-2.5 pb-2.5 flex flex-col gap-2">
                    {/* 화살표 [←][노출로][→] */}
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="!size-7"
                        onClick={() => moveUp(idx)}
                        disabled={!canMoveUp || pending}
                        aria-label="앞으로 이동"
                        title="앞으로 이동"
                      >
                        <ChevronLeft size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveToFront(idx)}
                        disabled={isFeatured || pending}
                        aria-label="노출로 설정"
                        title="노출로 설정"
                        className="flex-1 !h-7"
                      >
                        <Star size={11} />
                        노출로
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="!size-7"
                        onClick={() => moveDown(idx)}
                        disabled={!canMoveDown || pending}
                        aria-label="뒤로 이동"
                        title="뒤로 이동"
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                    {/* 공개 토글 + 삭제 */}
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <Switch
                          checked={banner.enabled}
                          onCheckedChange={() => handleToggleActive(banner)}
                          disabled={pending}
                          aria-label={banner.enabled ? '비공개로 전환' : '공개로 전환'}
                          className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
                        />
                        <span className="text-muted-foreground">
                          {banner.enabled ? '공개' : '비공개'}
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)] !text-xs !px-2"
                        onClick={() => setDeleteTarget(banner)}
                        disabled={pending}
                        aria-label="배너 삭제"
                      >
                        <Trash2 size={14} />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

        <ConfirmModal
          open={deleteTarget !== null}
          variant="danger"
          title="배너를 삭제하시겠습니까?"
          description="이 배너는 영원히 사라지며, 되돌릴 수 없습니다."
          confirmLabel="삭제"
          pending={pending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </>
  );
}

function formatPeriod(start: string, end: string): string {
  if (!start && !end) return '무제한';
  if (start && !end) return `${start} ~`;
  if (!start && end) return `~ ${end}`;
  return `${start} ~ ${end}`;
}
