'use client';

/* ══════════════════════════════════════════
   CafeEventsForm — /admin/cafe-events master-detail (S151 PR-2a)

   책임:
   - 좌측 list (이벤트 N개 — type pill + 상태 라벨)
   - 우측 edit form (선택된 이벤트 또는 신규 임시 row)
   - 5-type 분기 필드 조건부 렌더링
   - 22자 inline soft warn (h4 — 자문 §3.2)
   - 4 brk iframe 라이브 미리보기 (signature 패턴 답습)
   - createCafeEventAction · updateCafeEventAction · deleteCafeEventAction

   참조:
   - SettingsForm.tsx (signature 카드 — iframe + debounce + postMessage 패턴)
   - lib/cafeEvents.ts CafeEventSchema · composeEventEyebrow
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Textarea } from '@/components/admin/ui/textarea';
import ConfirmModal from '@/components/admin/ConfirmModal';
import {
  CAFE_EVENT_TYPES,
  composeEventEyebrow,
  todayIsoSeoul,
  type CafeEvent,
  type CafeEventType,
} from '@/lib/cafeEvents';
import { uploadCafeEventImage } from '@/lib/admin/uploadCafeEventImage';
import {
  createCafeEventAction,
  updateCafeEventAction,
  deleteCafeEventAction,
} from './actions';

/* ── Constants ─────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<CafeEventType, string> = {
  campaign: '캠페인',
  collab: '콜라보',
  seasonal: '시즌 한정',
  new_item: '신메뉴',
  oneplus: '1+1',
};

/** 자문 §3.2 — h4 권고 max 22자. schema 는 max(40) 이지만 visual cue 로 사용. */
const H4_SOFT_LIMIT = 22;
/** 자문 §3.2 — description 권고 max 80자. schema max(160). */
const DESC_SOFT_LIMIT = 80;

/** advisory §6.1 D-1 — 발행 전 4 brk 미리보기 검증 */
type PreviewBrk = 'desktop' | 'laptop' | 'tablet' | 'mobile';
const PREVIEW_BRK_OPTIONS: ReadonlyArray<{
  key: PreviewBrk;
  label: string;
  width: number;
}> = [
  { key: 'desktop', label: 'Desktop', width: 1440 },
  { key: 'laptop', label: 'Laptop', width: 1024 },
  { key: 'tablet', label: 'Tablet', width: 768 },
  { key: 'mobile', label: 'Mobile', width: 360 },
];

const TEMP_ID_PREFIX = 'temp:';

/* ── Types ─────────────────────────────────────────────────────────────── */

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

type DraftEvent = CafeEvent & {
  /** "temp:..." prefix → 신규 (DB INSERT 전). UUID → 기존 row. */
  id: string;
};

interface CafeEventsFormProps {
  initialEvents: CafeEvent[];
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function CafeEventsForm({ initialEvents }: CafeEventsFormProps) {
  const router = useRouter();
  const [events, setEvents] = useState<CafeEvent[]>(initialEvents);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEvents[0]?.id ?? null,
  );
  /** 편집 중인 임시 row (신규 OR 수정). null = 선택 없음. */
  const [draft, setDraft] = useState<DraftEvent | null>(
    initialEvents[0] ? { ...initialEvents[0] } : null,
  );
  const [isPending, startTransition] = useTransition();
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() =>
    draft ? buildPreviewSrc(draft) : '/preview/cafe-event?enabled=false',
  );
  const [previewHeight, setPreviewHeight] = useState<number>(360);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** 저장되지 않은 변경 사라짐 확인 — 선택 변경 또는 새 이벤트 두 경로 분기. */
  const [pendingNavigation, setPendingNavigation] = useState<
    { kind: 'select'; eventId: string } | { kind: 'new' } | null
  >(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  /* draft 변경 시 300ms debounce 후 iframe src 갱신 */
  useEffect(() => {
    if (!draft) {
      setPreviewSrc('/preview/cafe-event?enabled=false');
      return;
    }
    const timer = setTimeout(() => {
      setPreviewSrc(buildPreviewSrc(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);

  /* iframe 으로부터 height 수신 */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as unknown;
      if (
        typeof data === 'object' &&
        data !== null &&
        'type' in data &&
        (data as { type: unknown }).type === 'gtr:preview:height' &&
        'height' in data &&
        typeof (data as { height: unknown }).height === 'number'
      ) {
        const h = (data as { height: number }).height;
        if (h > 0 && h < 5000) setPreviewHeight(Math.ceil(h));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /* server fresh fetch → events 동기화. 편집 중 draft 는 건드리지 않음. */
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const isNew = draft !== null && draft.id.startsWith(TEMP_ID_PREFIX);
  const isDirty = useMemo(() => {
    if (!draft) return false;
    if (isNew) return true;
    const original = events.find((e) => e.id === draft.id);
    if (!original) return true;
    return !shallowEqualEvent(original, draft);
  }, [draft, events, isNew]);

  /** 동시 활성 max 1 룰 — 선택된 event 외에 활성·기간 겹치는 row 가 있으면 경고. */
  const activeConflict = useMemo(() => {
    if (!draft || !draft.enabled) return null;
    const today = todayIsoSeoul();
    const isWithinRange =
      (!draft.start_date || draft.start_date <= today) &&
      (!draft.end_date || draft.end_date >= today);
    if (!isWithinRange) return null;
    const others = events.filter((e) => {
      if (e.id === draft.id || !e.enabled) return false;
      if (e.start_date && e.start_date > today) return false;
      if (e.end_date && e.end_date < today) return false;
      return true;
    });
    return others.length > 0 ? others[0] : null;
  }, [draft, events]);

  /* ── Handlers ─────────────────────────────────────────────────────── */

  function applySelectEvent(id: string) {
    const ev = events.find((e) => e.id === id);
    setSelectedId(id);
    setDraft(ev ? { ...ev } : null);
  }

  function applyNew() {
    const tempId = `${TEMP_ID_PREFIX}${Date.now()}`;
    const newDraft: DraftEvent = {
      id: tempId,
      type: 'campaign',
      enabled: true,
      eyebrow: '',
      h4: '',
      meta: '',
      description: '',
      image_path: '',
      image_alt: '',
      start_date: '',
      end_date: '',
      recurring: null,
      linked_menu_slug: null,
      season_label: null,
      partner_name: null,
      cta_target: null,
      sort_order: 0,
    };
    setSelectedId(tempId);
    setDraft(newDraft);
  }

  function selectEvent(id: string) {
    if (isDirty) {
      setPendingNavigation({ kind: 'select', eventId: id });
      return;
    }
    applySelectEvent(id);
  }

  function handleNew() {
    if (isDirty) {
      setPendingNavigation({ kind: 'new' });
      return;
    }
    applyNew();
  }

  function confirmPendingNavigation() {
    const action = pendingNavigation;
    setPendingNavigation(null);
    if (!action) return;
    if (action.kind === 'select') applySelectEvent(action.eventId);
    else applyNew();
  }

  function handleReset() {
    if (!draft) return;
    if (isNew) {
      setDraft(null);
      setSelectedId(null);
      return;
    }
    const original = events.find((e) => e.id === draft.id);
    if (original) setDraft({ ...original });
  }

  function updateDraft<K extends keyof DraftEvent>(key: K, value: DraftEvent[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleTypeChange(type: CafeEventType) {
    setDraft((prev) => {
      if (!prev) return prev;
      /* type 변경 시 — 새 type 에 안 쓰이는 분기 필드는 NULL 로 reset.
         (UPDATE 시 stale 데이터 누수 방지 + Zod nullable 통과) */
      const next = { ...prev, type };
      if (type !== 'oneplus') next.recurring = null;
      if (type !== 'new_item') next.linked_menu_slug = null;
      if (type !== 'seasonal') next.season_label = null;
      if (type !== 'collab') next.partner_name = null;
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadState({ status: 'uploading', fileName: file.name });
    const result = await uploadCafeEventImage(file);
    if (result.ok) {
      updateDraft('image_path', result.publicUrl);
      setUploadState({ status: 'idle' });
      toast.success('이미지를 등록했습니다 · 저장 후 반영됩니다');
    } else {
      const message = describeUploadError(result.error, result.detail);
      setUploadState({ status: 'error', message });
      toast.error(message);
    }
  }

  function handleSave() {
    if (!draft) return;
    startTransition(async () => {
      if (isNew) {
        const { id: _, ...input } = draft;
        const result = await createCafeEventAction(input);
        if (result.ok) {
          toast.success('이벤트를 등록했습니다');
          setSelectedId(result.id);
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      } else {
        const result = await updateCafeEventAction(draft);
        if (result.ok) {
          toast.success('이벤트를 저장했습니다 · 사이트에 즉시 반영됩니다');
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      }
    });
  }

  function handleDelete() {
    if (!draft || isNew) return;
    setDeleteConfirmOpen(true);
  }

  function confirmDelete() {
    if (!draft || isNew) return;
    startTransition(async () => {
      const result = await deleteCafeEventAction(draft.id);
      if (result.ok) {
        toast.success('이벤트를 삭제했습니다');
        setDeleteConfirmOpen(false);
        setDraft(null);
        setSelectedId(null);
        router.refresh();
      } else {
        toast.error(describeError(result.error, result.detail));
      }
    });
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <>
      <AdminTopbarActions>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="!h-7"
          disabled={!isDirty || isPending}
          onClick={handleReset}
        >
          {isNew ? '취소' : '변경 취소'}
        </Button>
        <Button
          type="button"
          size="sm"
          className="!h-7"
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? '저장 중…' : isNew ? '생성' : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div className="mb-[22px] flex items-baseline justify-between">
        <div>
          <h2 className="m-0 text-2xl font-medium tracking-[-0.02em]">
            카페 이벤트 관리
          </h2>
          <div className="mt-1 text-sm text-[var(--foreground-muted)]">
            메인 §2.5 카페 메뉴 chapter 의 이벤트 row · 동시 활성 max 1
          </div>
        </div>
      </div>

      {/* 이벤트 목록 — 상단 수평 스크롤 스트립 */}
      <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="flex-1 text-sm font-medium">
            등록중인 이벤트
          </div>
          <Button type="button" variant="outline" size="sm" className="!h-7" onClick={handleNew}>
            + 새 이벤트
          </Button>
        </div>
        <div className="flex gap-2 p-3 overflow-x-auto">
          {isNew && draft && (
            <ListRow
              event={draft}
              selected
              isNew
              isPending={isPending}
              onClick={() => undefined}
            />
          )}
          {events.length === 0 && !draft && (
            <div className="py-3 text-xs text-[var(--foreground-muted)]">
              아직 등록된 이벤트가 없습니다.
            </div>
          )}
          {events.map((ev) => (
            <ListRow
              key={ev.id}
              event={ev}
              selected={selectedId === ev.id}
              isNew={false}
              isPending={isPending}
              onClick={() => selectEvent(ev.id)}
              onDelete={selectedId === ev.id ? handleDelete : undefined}
            />
          ))}
        </div>
      </div>

      {/* Detail — 전체 너비 */}
      <div className="flex flex-col gap-3 min-w-0">
          {!draft ? (
            <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] py-12 px-10 text-center text-sm text-[var(--foreground-muted)]">
              위에서 이벤트를 선택하거나 [+ 새 이벤트] 를 눌러주세요.
            </div>
          ) : (
            <>
              {/* 동시 활성 충돌 경고 */}
              {activeConflict && (
                <div className="px-3 py-2.5 rounded-md bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)] text-xs">
                  ⚠ 활성 충돌 — 같은 기간에 "{activeConflict.h4 || '이름 없음'}" 이 이미
                  활성 상태입니다. 동시 활성 max 1 (자문 §5.3) — 우선순위 높은 1개만 노출됩니다.
                </div>
              )}

              {/* 기본 정보 카드 */}
              <Card title="기본 정보" subtitle="이벤트 type · 활성 · 노출 정렬">
                <div className="flex flex-col gap-3">
                  <FormField label="이벤트 type" required>
                    <div className="flex gap-1.5 flex-wrap">
                      {CAFE_EVENT_TYPES.map((t) => {
                        const sel = draft.type === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            data-slot="chip-radio"
                            onClick={() => handleTypeChange(t)}
                            aria-pressed={sel}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer',
                              sel
                                ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                                : 'bg-[var(--surface)] text-foreground border-border',
                            )}
                          >
                            {TYPE_LABELS[t]}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>

                  <div className="flex gap-6 items-start flex-wrap">
                    <FormField label="활성">
                      <label className="flex gap-2 items-center h-[34px] cursor-pointer">
                        <Checkbox
                          checked={draft.enabled}
                          onCheckedChange={(v) => updateDraft('enabled', v === true)}
                        />
                        <span className="text-sm">
                          {draft.enabled ? '활성 (B2C 노출 후보)' : '비활성 (저장만)'}
                        </span>
                      </label>
                    </FormField>
                    <FormField label="정렬 순서" hint="작은 값이 먼저 (동률 fallback)">
                      <div className="w-24">
                        <FormInput
                          type="number"
                          value={String(draft.sort_order)}
                          onChange={(e) =>
                            updateDraft('sort_order', parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </div>
                    </FormField>
                  </div>
                </div>
              </Card>

              {/* 카피 카드 */}
              <Card title="카피" subtitle="자문 §3.2 — h4 max 22자 권고 · description max 80자 권고">
                <div className="flex flex-col gap-3">
                  <FormField
                    label="Eyebrow"
                    hint={`자동 합성 예: "${composeEventEyebrow(draft)}" — 빈 값 시 자동 합성 사용`}
                  >
                    <FormInput
                      value={draft.eyebrow}
                      onChange={(e) => updateDraft('eyebrow', e.target.value)}
                      placeholder={composeEventEyebrow(draft) || '예: Now On · ~5/31'}
                    />
                  </FormField>

                  <FormField
                    label="제목 (h4)"
                    required
                    hint={
                      <span
                        className={
                          draft.h4.length > H4_SOFT_LIMIT
                            ? 'text-[var(--warning)]'
                            : 'text-[var(--foreground-muted)]'
                        }
                      >
                        {draft.h4.length}/{H4_SOFT_LIMIT}자 권고 (max 40)
                        {draft.h4.length > H4_SOFT_LIMIT &&
                          ' · 모바일 wrap 깨짐 위험'}
                      </span>
                    }
                  >
                    <FormInput
                      value={draft.h4}
                      maxLength={40}
                      onChange={(e) => updateDraft('h4', e.target.value)}
                      placeholder="예: 가족과 함께라면, 음료 한 잔 더 무료"
                    />
                  </FormField>

                  <FormField label="메타 (요일·매장·가격 등 mono)">
                    <FormInput
                      value={draft.meta}
                      maxLength={80}
                      onChange={(e) => updateDraft('meta', e.target.value)}
                      placeholder="예: 5월 한 달 · 매장 한정 · 가족 동반"
                    />
                  </FormField>

                  <FormField
                    label="본문 (1~2줄)"
                    hint={
                      <span
                        className={
                          draft.description.length > DESC_SOFT_LIMIT
                            ? 'text-[var(--warning)]'
                            : 'text-[var(--foreground-muted)]'
                        }
                      >
                        {draft.description.length}/{DESC_SOFT_LIMIT}자 권고 (max 160)
                      </span>
                    }
                  >
                    <Textarea
                      value={draft.description}
                      maxLength={160}
                      onChange={(e) => updateDraft('description', e.target.value)}
                      placeholder="예: 부모님과 아이가 함께 방문하시면 음료 한 잔을 무료로 드립니다."
                      rows={3}
                    />
                  </FormField>
                </div>
              </Card>

              {/* 이미지 카드 */}
              <Card title="이미지" subtitle="1:1 정사각 권장 · 최대 5MB · webp/avif/jpeg/png">
                <div className="grid grid-cols-[1fr_240px] gap-4 items-start">
                  <div className="flex flex-col gap-3 min-w-0">
                    <FormField label="대체 텍스트 (alt)">
                      <FormInput
                        value={draft.image_alt}
                        maxLength={120}
                        onChange={(e) => updateDraft('image_alt', e.target.value)}
                        placeholder="예: 5월 가정의 달 이벤트 일러스트"
                      />
                    </FormField>
                    <FormField label="이미지 경로" hint="업로드 후 자동 입력 · 직접 편집 가능">
                      <FormInput
                        value={draft.image_path}
                        maxLength={500}
                        onChange={(e) => updateDraft('image_path', e.target.value)}
                        placeholder="/images/cafe-events/... 또는 https://..."
                      />
                    </FormField>
                  </div>

                  <div>
                    {draft.image_path ? (
                      <div
                        className="rounded-md overflow-hidden border border-border aspect-square bg-cover bg-center"
                        style={{ backgroundImage: `url("${draft.image_path}")` }}
                      />
                    ) : (
                      <div
                        className="rounded-md overflow-hidden border border-border aspect-square flex items-center justify-center text-[var(--foreground-muted)] text-xs"
                        style={{
                          background:
                            'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 6px, var(--placeholder-pattern-2) 6px 12px)',
                        }}
                      >
                        이미지 없음
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/webp,image/avif,image/jpeg,image/png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="!h-7 w-full mt-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadState.status === 'uploading'}
                    >
                      {uploadState.status === 'uploading' ? '업로드 중…' : '이미지 변경'}
                    </Button>
                    {uploadState.status === 'error' && (
                      <div className="mt-2 px-2.5 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
                        {uploadState.message}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* 기간 + type 분기 카드 */}
              <Card
                title="기간 · 분기 필드"
                subtitle="ISO 날짜 (YYYY-MM-DD) · 빈 값 = 상시 노출"
              >
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="시작일" hint="비워두면 상시 노출 (start 무관)">
                      <FormInput
                        type="date"
                        value={draft.start_date}
                        onChange={(e) => updateDraft('start_date', e.target.value)}
                      />
                    </FormField>
                    <FormField label="종료일" hint="비워두면 상시 노출 (end 무관)">
                      <FormInput
                        type="date"
                        value={draft.end_date}
                        onChange={(e) => updateDraft('end_date', e.target.value)}
                      />
                    </FormField>
                  </div>

                  {/* type 분기 필드 */}
                  {draft.type === 'oneplus' && (
                    <FormField
                      label="반복 (recurring)"
                      hint='예: "매주 화" · "매월 첫 주말" — eyebrow 자동 합성에 사용'
                    >
                      <FormInput
                        value={draft.recurring ?? ''}
                        maxLength={40}
                        onChange={(e) =>
                          updateDraft('recurring', e.target.value || null)
                        }
                        placeholder="예: 매주 화"
                      />
                    </FormField>
                  )}
                  {draft.type === 'new_item' && (
                    <FormField
                      label="연결 메뉴 slug"
                      hint="신메뉴 type — 카페 메뉴 chapter 의 메뉴 slug"
                    >
                      <FormInput
                        value={draft.linked_menu_slug ?? ''}
                        maxLength={80}
                        onChange={(e) =>
                          updateDraft('linked_menu_slug', e.target.value || null)
                        }
                        placeholder="예: spring-yuzu-latte"
                      />
                    </FormField>
                  )}
                  {draft.type === 'seasonal' && (
                    <FormField
                      label="시즌 라벨 (season_label)"
                      hint='예: "Spring" · "May" — eyebrow 자동 합성에 사용'
                    >
                      <FormInput
                        value={draft.season_label ?? ''}
                        maxLength={40}
                        onChange={(e) =>
                          updateDraft('season_label', e.target.value || null)
                        }
                        placeholder="예: Spring"
                      />
                    </FormField>
                  )}
                  {draft.type === 'collab' && (
                    <FormField label="파트너명 (partner_name)">
                      <FormInput
                        value={draft.partner_name ?? ''}
                        maxLength={80}
                        onChange={(e) =>
                          updateDraft('partner_name', e.target.value || null)
                        }
                        placeholder="예: 굿데이즈"
                      />
                    </FormField>
                  )}
                </div>
              </Card>

              {/* CTA 카드 */}
              <Card title="CTA" subtitle="비워두면 버튼 없음 — null 저장">
                <FormField
                  label="CTA 링크"
                  hint={'비워두면 “자세히 →” 버튼 노출 안 함'}
                >
                  <FormInput
                    value={draft.cta_target ?? ''}
                    maxLength={200}
                    onChange={(e) => updateDraft('cta_target', e.target.value || null)}
                    placeholder="예: /events/family-month-2026 또는 /menu?cat=signature"
                  />
                </FormField>
              </Card>

              {/* Preview */}
              <PreviewPane
                previewBrk={previewBrk}
                onSelectBrk={setPreviewBrk}
                previewSrc={previewSrc}
                previewHeight={previewHeight}
                isDirty={isDirty}
              />
            </>
          )}
        </div>

      <ConfirmModal
        open={pendingNavigation !== null}
        title="저장하지 않은 변경이 있습니다"
        description="이 페이지에서 빠져나가면 변경 내용이 사라집니다. 계속할까요?"
        confirmLabel="계속"
        cancelLabel="머무르기"
        onCancel={() => setPendingNavigation(null)}
        onConfirm={confirmPendingNavigation}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        variant="danger"
        title="이벤트를 삭제하시겠습니까?"
        description={
          <>
            <strong className="text-foreground">
              {draft?.h4 || '이름 없음'}
            </strong>{' '}
            이벤트가 영원히 사라지며, 되돌릴 수 없습니다.
          </>
        }
        confirmLabel="삭제"
        pending={isPending}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/* ── List Row ──────────────────────────────────────────────────────────── */

function ListRow({
  event,
  selected,
  isNew,
  isPending,
  onClick,
  onDelete,
}: {
  event: CafeEvent;
  selected: boolean;
  isNew: boolean;
  isPending: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const today = todayIsoSeoul();
  const status: 'active' | 'coming' | 'past' | 'disabled' = !event.enabled
    ? 'disabled'
    : event.start_date && event.start_date > today
      ? 'coming'
      : event.end_date && event.end_date < today
        ? 'past'
        : 'active';
  const statusLabel = isNew
    ? '신규'
    : status === 'active'
      ? '진행중'
      : status === 'coming'
        ? '예정'
        : status === 'past'
          ? '종료'
          : '비활성';
  const statusClass = isNew
    ? 'text-[var(--info)]'
    : status === 'active'
      ? 'text-[var(--success)]'
      : status === 'coming'
        ? 'text-[var(--info)]'
        : status === 'past'
          ? 'text-[var(--foreground-muted)]'
          : 'text-[var(--foreground-subtle)]';

  return (
    <div
      className={cn(
        'flex flex-col w-[180px] flex-shrink-0 rounded-md border overflow-hidden',
        selected
          ? 'bg-[var(--surface-muted)] border-[var(--primary)]'
          : 'bg-[var(--surface)] border-border',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex flex-col gap-1 px-3 py-2.5 text-left cursor-pointer font-[inherit] border-none bg-transparent w-full',
          !selected && 'hover:bg-[var(--surface-muted)]',
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--foreground-muted)] border border-border">
            {TYPE_LABELS[event.type]}
          </span>
          <span className={cn('text-xs font-medium', statusClass)}>
            {statusLabel}
          </span>
        </div>
        <div className="text-xs font-medium text-[var(--foreground)] overflow-hidden text-ellipsis whitespace-nowrap w-full">
          {event.h4 || <span className="text-[var(--foreground-muted)]">이름 없음</span>}
        </div>
        <div className="text-xs text-[var(--foreground-muted)] font-mono">
          {event.start_date || '∞'} ~ {event.end_date || '∞'}
        </div>
      </button>
      {onDelete && !isNew && (
        <div className="px-3 py-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!h-7 !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
            disabled={isPending}
            onClick={onDelete}
          >
            <Trash2 size={14} />
            삭제
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Preview Pane ──────────────────────────────────────────────────────── */

function PreviewPane({
  previewBrk,
  onSelectBrk,
  previewSrc,
  previewHeight,
  isDirty,
}: {
  previewBrk: PreviewBrk;
  onSelectBrk: (brk: PreviewBrk) => void;
  previewSrc: string;
  previewHeight: number;
  isDirty: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h3 className="m-0 text-sm font-medium">EventBanner 미리보기</h3>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5">
            저장 전 4 brk 검증 · 편집 중 즉시 반영
          </div>
        </div>
        <div className="flex gap-1">
          {PREVIEW_BRK_OPTIONS.map((opt) => {
            const sel = previewBrk === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                data-slot="chip-radio"
                onClick={() => onSelectBrk(opt.key)}
                aria-pressed={sel}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer whitespace-nowrap',
                  sel
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                    : 'bg-[var(--surface)] text-foreground border-border',
                )}
              >
                {opt.label}{' '}
                <span className="opacity-70 ml-1 font-mono text-xs">
                  {opt.width}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {isDirty && (
        <div className="px-4 py-1.5 bg-[var(--warning-soft)] text-[var(--warning)] text-xs border-b border-border">
          저장되지 않은 변경 — 미리보기는 즉시 반영 · 저장 시 라이브 사이트 반영
        </div>
      )}
      <div className="p-4 bg-[var(--surface-muted)] overflow-x-auto overflow-y-hidden flex justify-start">
        <iframe
          src={previewSrc}
          title={`EventBanner 미리보기 — ${previewBrk}`}
          style={{
            width: PREVIEW_BRK_OPTIONS.find((o) => o.key === previewBrk)?.width ?? 1440,
            height: previewHeight,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--color-background-primary, #FBF8F3)',
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function shallowEqualEvent(a: CafeEvent, b: CafeEvent): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.enabled === b.enabled &&
    a.eyebrow === b.eyebrow &&
    a.h4 === b.h4 &&
    a.meta === b.meta &&
    a.description === b.description &&
    a.image_path === b.image_path &&
    a.image_alt === b.image_alt &&
    a.start_date === b.start_date &&
    a.end_date === b.end_date &&
    a.recurring === b.recurring &&
    a.linked_menu_slug === b.linked_menu_slug &&
    a.season_label === b.season_label &&
    a.partner_name === b.partner_name &&
    a.cta_target === b.cta_target &&
    a.sort_order === b.sort_order
  );
}

/** DraftEvent → /preview/cafe-event URL. URLSearchParams 가 자동 encode. */
function buildPreviewSrc(draft: DraftEvent): string {
  const params = new URLSearchParams({
    enabled: String(draft.enabled),
    type: draft.type,
    eyebrow: draft.eyebrow,
    h4: draft.h4,
    meta: draft.meta,
    description: draft.description,
    image_path: draft.image_path,
    image_alt: draft.image_alt,
    start_date: draft.start_date,
    end_date: draft.end_date,
    recurring: draft.recurring ?? '',
    season_label: draft.season_label ?? '',
    partner_name: draft.partner_name ?? '',
    cta_target: draft.cta_target ?? '',
  });
  return `/preview/cafe-event?${params.toString()}`;
}

function describeUploadError(error: string, detail?: string): string {
  switch (error) {
    case 'too_large':
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하로 다시 시도해 주세요'}`;
    case 'unsupported_type':
      return `지원하지 않는 파일 형식이에요 — ${detail ?? 'webp/avif/jpeg/png 만 가능합니다'}`;
    case 'unauthorized':
      return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
    case 'public_url_failed':
      return '업로드는 됐지만 주소를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'upload_failed':
    default:
      return '이미지를 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

function describeError(error: string, detail?: string): string {
  switch (error) {
    case 'unauthorized':
      return '권한이 없습니다. 다시 로그인해 주세요.';
    case 'validation_failed':
      return `입력값을 확인해 주세요${detail ? ` (${detail})` : ''}`;
    case 'not_found':
      return '이벤트를 찾을 수 없습니다 (이미 삭제됐을 수 있어요).';
    case 'server_error':
    default:
      return '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

/* ── 공용 컴포넌트 ─────────────────────────────────── */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="m-0 text-sm font-medium">{title}</h3>
        <div className="text-xs text-[var(--foreground-muted)] mt-0.5">{subtitle}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && (
        <div className="pl-2.5 text-xs text-[var(--foreground-muted)]">{hint}</div>
      )}
    </div>
  );
}

function FormInput({
  prefix,
  suffix,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
}) {
  const disabled = rest.disabled === true;
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 h-[34px] border border-input rounded-md',
        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:border-ring',
        disabled ? 'bg-[var(--surface-muted)] opacity-70' : 'bg-[var(--surface)]',
      )}
    >
      {prefix && (
        <span className="text-[var(--foreground-muted)] text-sm">{prefix}</span>
      )}
      <input
        {...rest}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-[var(--foreground)] p-0 h-full shadow-none ring-0"
      />
      {suffix && (
        <span className="text-[var(--foreground-muted)] text-xs">{suffix}</span>
      )}
    </div>
  );
}

/* S222 PR-5b: TEXTAREA_STYLE / SM_BASE/SECONDARY/GHOST/GHOST_DANGER/PRIMARY 폐기
   (shadcn Button / Textarea 으로 대체). FormInput 로컬 wrapper 는 prefix/suffix 유지. */
