'use client';

/* ══════════════════════════════════════════
   CafeEventsForm — /admin/cafe-events master-detail (S234 후속 · 060 iframe 진화)

   책임:
   - 좌측 list (이벤트 N개 — type pill + 상태 라벨)
   - 우측 edit form (선택된 이벤트 또는 신규 임시 row)
   - 운영자 .html 파일 업로드 (custom_html_path)
   - brk 별 aspect-ratio 3 입력 (1320/480 형식)
   - 4 brk iframe 라이브 미리보기

   참조:
   - 060_cafe_events_iframe_html.sql
   - SettingsForm.tsx (signature 카드 — iframe + debounce + postMessage 패턴)
   - admin-design.md §5-1 ~ §5-25
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import ConfirmModal from '@/components/admin/ConfirmModal';
import {
  CAFE_EVENT_TYPES,
  CAFE_EVENT_TYPE_LABELS,
  todayIsoSeoul,
  type CafeEvent,
  type CafeEventType,
} from '@/lib/cafeEvents';
import { uploadCafeEventHtml } from '@/lib/admin/uploadCafeEventHtml';
import {
  createCafeEventAction,
  updateCafeEventAction,
  deleteCafeEventAction,
} from './actions';

/* ── Constants ─────────────────────────────────────────────────────────── */

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

const ASPECT_RE = /^\s*\d+(\.\d+)?\s*[/]\s*\d+(\.\d+)?\s*$/;

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
  const [draft, setDraft] = useState<DraftEvent | null>(
    initialEvents[0] ? { ...initialEvents[0] } : null,
  );
  const [isPending, startTransition] = useTransition();
  const [htmlUpload, setHtmlUpload] = useState<UploadState>({ status: 'idle' });

  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() =>
    draft ? buildPreviewSrc(draft) : '/preview/cafe-event?enabled=false',
  );
  const [previewHeight, setPreviewHeight] = useState<number>(480);

  const htmlInputRef = useRef<HTMLInputElement | null>(null);

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

  /* iframe 으로부터 height 수신 (preview 페이지가 postMessage 로 전달) */
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
      custom_html_path: '',
      aspect_desktop: '1320/480',
      aspect_tablet: '1024/400',
      aspect_mobile: '390/640',
      image_alt: '',
      start_date: '',
      end_date: '',
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

  async function handleHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadCafeEventHtml(file);
    if (result.ok) {
      updateDraft('custom_html_path', result.publicUrl);
      setHtmlUpload({ status: 'idle' });
      toast.success('HTML 파일을 등록했습니다', {
        description: '변경사항 저장 후 사이트에 반영됩니다',
      });
    } else {
      const message = describeUploadError(result.error, result.detail);
      setHtmlUpload({ status: 'error', message });
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
          toast.success('이벤트를 저장했습니다', {
            description: '사이트에 즉시 반영됩니다',
          });
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

      <AdminPageHeader
        title="카페 이벤트 관리"
        subtitle="메인 §2.5 카페 메뉴 chapter 의 이벤트 배너 · iframe HTML 임베드 · 동시 활성 max 1"
        className="mb-6"
      />

      {/* 이벤트 목록 — 상단 수평 스크롤 스트립 */}
      <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden mb-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="flex-1 text-sm font-medium">등록중인 이벤트</div>
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

      {/* Detail */}
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
                ⚠ 활성 충돌 — 같은 기간에 다른 이벤트
                ({CAFE_EVENT_TYPE_LABELS[activeConflict.type]}) 가 이미 활성 상태입니다.
                동시 활성 max 1 (자문 §5.3) — 우선순위 높은 1개만 노출됩니다.
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
                          onClick={() => updateDraft('type', t)}
                          aria-pressed={sel}
                          className={cn(
                            'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer',
                            sel
                              ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                              : 'bg-[var(--surface)] text-foreground border-border',
                          )}
                        >
                          {CAFE_EVENT_TYPE_LABELS[t]}
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

            {/* HTML 카드 */}
            <Card
              title="배너 HTML 파일"
              subtitle="이미지 · CSS · SVG · 폰트 모두 포함된 단일 .html 파일. iframe sandbox (allow-same-origin) 으로 임베드 — script 차단."
            >
              <div className="flex flex-col gap-3">
                <FormField label="대체 텍스트 (alt · iframe title)" required>
                  <FormInput
                    value={draft.image_alt}
                    maxLength={120}
                    onChange={(e) => updateDraft('image_alt', e.target.value)}
                    placeholder="예: UBE 시리즈 배너 — 자색 고구마 라떼 메뉴 소개"
                  />
                </FormField>

                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={htmlInputRef}
                    type="file"
                    accept=".html,.htm,text/html"
                    onChange={handleHtmlUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!h-8"
                    onClick={() => htmlInputRef.current?.click()}
                    disabled={htmlUpload.status === 'uploading'}
                  >
                    {htmlUpload.status === 'uploading' ? '업로드 중…' : 'HTML 파일 선택'}
                  </Button>
                  <span className="text-xs text-[var(--foreground-muted)]">
                    {draft.custom_html_path
                      ? `등록됨 · ${summarizeUrl(draft.custom_html_path)}`
                      : '선택된 파일 없음 · 5MB 이하 · .html'}
                  </span>
                  {draft.custom_html_path && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-7 !text-xs !text-[var(--danger)] hover:!bg-[var(--danger-soft)] ml-auto"
                      onClick={() => updateDraft('custom_html_path', '')}
                    >
                      <Trash2 size={14} />
                      제거
                    </Button>
                  )}
                </div>
                {htmlUpload.status === 'error' && (
                  <div className="px-2.5 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
                    {htmlUpload.message}
                  </div>
                )}
                {draft.custom_html_path && (
                  <a
                    href={draft.custom_html_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pl-2.5 text-xs text-[var(--foreground-muted)] underline-offset-2 hover:underline"
                  >
                    HTML 원본 열기 ↗
                  </a>
                )}
              </div>
            </Card>

            {/* aspect-ratio 카드 */}
            <Card
              title="iframe 컨테이너 비율"
              subtitle="brk 별 가로/세로 비율. 'W/H' 형식. 컨테이너 너비 = 100%, 높이 = 너비 ÷ 비율."
            >
              <div className="grid grid-cols-3 gap-3">
                <AspectInput
                  label="Desktop (≥1024px)"
                  value={draft.aspect_desktop}
                  onChange={(v) => updateDraft('aspect_desktop', v)}
                  placeholder="1320/480"
                />
                <AspectInput
                  label="Tablet (768~1023px)"
                  value={draft.aspect_tablet}
                  onChange={(v) => updateDraft('aspect_tablet', v)}
                  placeholder="1024/400"
                />
                <AspectInput
                  label="Mobile (<768px)"
                  value={draft.aspect_mobile}
                  onChange={(v) => updateDraft('aspect_mobile', v)}
                  placeholder="390/640"
                />
              </div>
            </Card>

            {/* 기간 카드 */}
            <Card title="기간" subtitle="ISO 날짜 (YYYY-MM-DD) · 빈 값 = 상시 노출">
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
              {draft ? CAFE_EVENT_TYPE_LABELS[draft.type] : ''}
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

/* ── Aspect Input ───────────────────────────────────────────────────────── */

function AspectInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const invalid = value !== '' && !ASPECT_RE.test(value);
  return (
    <FormField
      label={label}
      hint={
        invalid ? (
          <span className="text-[var(--warning)]">형식 오류 — "W/H" (예: 1320/480)</span>
        ) : (
          '예: 1320/480 = 2.75:1 가로 와이드'
        )
      }
    >
      <FormInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={40}
      />
    </FormField>
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
        'flex flex-col w-[200px] flex-shrink-0 rounded-md border overflow-hidden',
        selected
          ? 'bg-[var(--surface-muted)] border-[var(--primary)]'
          : 'bg-[var(--surface)] border-border',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex flex-col gap-1.5 px-3 py-2.5 text-left cursor-pointer font-[inherit] border-none bg-transparent w-full',
          !selected && 'hover:bg-[var(--surface-muted)]',
        )}
      >
        <div className="w-full aspect-video rounded-sm border border-border bg-[var(--surface-muted)] flex items-center justify-center text-xs text-[var(--foreground-muted)]">
          {event.custom_html_path ? 'HTML 등록됨' : 'HTML 없음'}
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--foreground-muted)] border border-border">
            {CAFE_EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className={cn('text-xs font-medium', statusClass)}>{statusLabel}</span>
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
                <span className="opacity-70 ml-1 font-mono text-xs">{opt.width}</span>
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
    a.custom_html_path === b.custom_html_path &&
    a.aspect_desktop === b.aspect_desktop &&
    a.aspect_tablet === b.aspect_tablet &&
    a.aspect_mobile === b.aspect_mobile &&
    a.image_alt === b.image_alt &&
    a.start_date === b.start_date &&
    a.end_date === b.end_date &&
    a.sort_order === b.sort_order
  );
}

/** DraftEvent → /preview/cafe-event URL. URLSearchParams 가 자동 encode. */
function buildPreviewSrc(draft: DraftEvent): string {
  const params = new URLSearchParams({
    enabled: String(draft.enabled),
    type: draft.type,
    custom_html_path: draft.custom_html_path,
    aspect_desktop: draft.aspect_desktop,
    aspect_tablet: draft.aspect_tablet,
    aspect_mobile: draft.aspect_mobile,
    image_alt: draft.image_alt,
  });
  return `/preview/cafe-event?${params.toString()}`;
}

function summarizeUrl(url: string): string {
  const parts = url.split('/');
  const name = parts[parts.length - 1] ?? url;
  return name.length > 36 ? `${name.slice(0, 32)}…` : name;
}

function describeUploadError(error: string, detail?: string): string {
  switch (error) {
    case 'too_large':
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하로 다시 시도해 주세요'}`;
    case 'unsupported_type':
      return `지원하지 않는 파일 형식이에요 — ${detail ?? '.html 파일만 지원합니다'}`;
    case 'unauthorized':
      return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
    case 'public_url_failed':
      return '업로드는 됐지만 주소를 만들지 못했습니다. 다시 시도해 주세요.';
    case 'upload_failed':
    default:
      return '파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.';
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
