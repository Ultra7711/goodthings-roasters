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
import { Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { describeError, describeUploadError } from '@/lib/admin/errorDescribe';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import ConfirmModal from '@/components/admin/ConfirmModal';
import {
  CAFE_EVENT_TYPES,
  CAFE_EVENT_TYPE_LABELS,
  todayIsoSeoul,
  type CafeEventBanner,
  type CafeEventType,
} from '@/lib/banners';
import { uploadBannerHtml } from '@/lib/admin/uploadBannerHtml';
import { buildBannerAiPrompt } from '@/lib/admin/aiPrompt';
import {
  uploadBannerImage,
  type BannerBreakpoint,
} from '@/lib/admin/uploadBannerImage';
import {
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
} from '../banners/actions';

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

/* ── Types ─────────────────────────────────────────────────────────────── */

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

type DraftEvent = CafeEventBanner & {
  /** "temp:..." prefix → 신규 (DB INSERT 전). UUID → 기존 row. */
  id: string;
};

interface CafeEventsFormProps {
  initialEvents: CafeEventBanner[];
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function CafeEventsForm({ initialEvents }: CafeEventsFormProps) {
  const router = useRouter();
  const [events, setEvents] = useState<CafeEventBanner[]>(initialEvents);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEvents[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<DraftEvent | null>(
    initialEvents[0] ? { ...initialEvents[0] } : null,
  );
  const [isPending, startTransition] = useTransition();
  const [htmlUpload, setHtmlUpload] = useState<UploadState>({ status: 'idle' });
  const [desktopUpload, setDesktopUpload] = useState<UploadState>({ status: 'idle' });
  const [tabletUpload, setTabletUpload] = useState<UploadState>({ status: 'idle' });
  const [mobileUpload, setMobileUpload] = useState<UploadState>({ status: 'idle' });

  /* HTML 텍스트 직접 입력 (AI 결과 코드 블록 붙여넣기용) */
  const [htmlTextOpen, setHtmlTextOpen] = useState(false);
  const [htmlText, setHtmlText] = useState('');

  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() =>
    draft ? buildPreviewSrc(draft) : '/preview/cafe-event?enabled=false',
  );
  const [previewHeight, setPreviewHeight] = useState<number>(480);

  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const tabletInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

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

  /** 동시 활성 max 1 룰 — 선택된 event 외에 활성 · 기간 겹치는 row 가 있으면 경고. */
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
      kind: 'cafe_event',
      type: 'campaign',
      enabled: true,
      custom_html_path: '',
      image_path_desktop: '',
      image_path_tablet: '',
      image_path_mobile: '',
      image_blur_desktop: '',
      image_blur_tablet: '',
      image_blur_mobile: '',
      aspect_desktop: '1320/480',
      aspect_tablet: '1024/400',
      aspect_mobile: '390/640',
      image_alt: '',
      headline_text: '',
      subhead_text: '',
      cta_text: '',
      cta_href: '',
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

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    brk: BannerBreakpoint,
  ) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const setState =
      brk === 'desktop'
        ? setDesktopUpload
        : brk === 'tablet'
          ? setTabletUpload
          : setMobileUpload;
    const fieldKey =
      brk === 'desktop'
        ? 'image_path_desktop'
        : brk === 'tablet'
          ? 'image_path_tablet'
          : 'image_path_mobile';
    const blurKey =
      brk === 'desktop'
        ? 'image_blur_desktop'
        : brk === 'tablet'
          ? 'image_blur_tablet'
          : 'image_blur_mobile';
    const aspectKey =
      brk === 'desktop'
        ? 'aspect_desktop'
        : brk === 'tablet'
          ? 'aspect_tablet'
          : 'aspect_mobile';

    setState({ status: 'uploading', fileName: file.name });
    /* 이미지 dimension 측정 — aspect 자동 입력. 실패 시 기본값 유지. */
    const aspect = await measureImageAspect(file).catch(() => null);
    const result = await uploadBannerImage(file, 'cafe_event', brk);
    if (result.ok) {
      updateDraft(fieldKey, result.publicUrl);
      /* S246: LQIP — 업로드 핸들러가 server action 으로 생성. 실패 시 빈 문자열. */
      updateDraft(blurKey, result.blurDataURL ?? '');
      if (aspect) updateDraft(aspectKey, aspect);
      setState({ status: 'idle' });
      toast.success('이미지를 등록했습니다', {
        description: aspect
          ? `비율 ${aspect} 자동 입력 · 변경사항 저장 후 사이트에 반영됩니다`
          : '변경사항 저장 후 사이트에 반영됩니다',
      });
    } else {
      const message = describeUploadError(result.error, result.detail);
      setState({ status: 'error', message });
      toast.error(message);
    }
  }

  async function handleHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadBannerHtml(file, 'cafe_event');
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

  /* AI 결과 코드 블록 텍스트 → Blob → File 변환 후 기존 업로드 경로 재사용. */
  async function handleHtmlTextUpload() {
    const text = htmlText.trim();
    if (!text) {
      toast.error('HTML 텍스트를 붙여넣어 주세요');
      return;
    }
    const blob = new Blob([text], { type: 'text/html' });
    const file = new File([blob], 'banner.html', { type: 'text/html' });

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadBannerHtml(file, 'cafe_event');
    if (result.ok) {
      updateDraft('custom_html_path', result.publicUrl);
      setHtmlUpload({ status: 'idle' });
      setHtmlText('');
      setHtmlTextOpen(false);
      toast.success('HTML 텍스트를 등록했습니다', {
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
        const result = await createBannerAction(input);
        if (result.ok) {
          toast.success('이벤트를 등록했습니다');
          setSelectedId(result.id);
          /* TEMP_ID → 실 UUID 로 교체 — isNew 해제 + list 의 신규/실 row 중복 방지 */
          setDraft((prev) => (prev ? { ...prev, id: result.id } : prev));
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      } else {
        const result = await updateBannerAction(draft);
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
      const result = await deleteBannerAction({ id: draft.id, kind: 'cafe_event' });
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
          variant="outline"
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
          {isPending
            ? isNew
              ? '등록 중…'
              : '저장 중…'
            : isNew
              ? '이벤트 등록'
              : '변경사항 저장'}
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

            {/* 이미지 3종 카드 */}
            <Card
              title="이미지 (반응형 3종)"
              subtitle={
                <>
                  원본 배너 이미지에서 텍스트와 작은 디자인 요소를 제거한 깨끗한 배경 이미지를 등록합니다.
                  <br />
                  우측 'AI prompt 복사' 버튼으로 Gemini 같은 이미지 AI 에 의뢰하실 때 원본 배너 이미지 1장을 함께 첨부해 주시면 AI 가 배경 이미지를 만들어줍니다.
                  <br />
                  데스크탑 · 모바일 2장만 등록하시는 것을 권장해요. 태블릿은 비우면 데스크탑 이미지를 자동으로 사용합니다 (AI 가 데스크탑과 다른 태블릿 비율을 만들기 어려워서 별도 생성 비추천).
                </>
              }
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!h-7 !text-xs"
                  onClick={async () => {
                    const prompt = buildBannerAiPrompt({
                      kind: 'cafe-event',
                      aspectDesktop: draft.aspect_desktop,
                      aspectTablet: draft.aspect_tablet,
                      aspectMobile: draft.aspect_mobile,
                    });
                    try {
                      await navigator.clipboard.writeText(prompt);
                      toast.success('AI prompt 를 복사했습니다', {
                        description: 'Gemini · ChatGPT image 등에 원본 배너 이미지를 함께 첨부해 사용하세요.',
                      });
                    } catch {
                      toast.error('복사에 실패했습니다 — 수동으로 복사해 주세요');
                    }
                  }}
                >
                  <Copy size={14} />
                  AI prompt 복사
                </Button>
              }
            >
              <div className="grid grid-cols-3 gap-3">
                <ImageUploadSlot
                  label="Desktop"
                  sublabel="{{IMAGE_DESKTOP}}"
                  required
                  imagePath={draft.image_path_desktop}
                  uploadState={desktopUpload}
                  inputRef={desktopInputRef}
                  onUpload={(e) => handleImageUpload(e, 'desktop')}
                  onClear={() => {
                    updateDraft('image_path_desktop', '');
                    updateDraft('image_blur_desktop', '');
                  }}
                />
                <ImageUploadSlot
                  label="Tablet"
                  sublabel="{{IMAGE_TABLET}}"
                  imagePath={draft.image_path_tablet}
                  uploadState={tabletUpload}
                  inputRef={tabletInputRef}
                  onUpload={(e) => handleImageUpload(e, 'tablet')}
                  onClear={() => {
                    updateDraft('image_path_tablet', '');
                    updateDraft('image_blur_tablet', '');
                  }}
                />
                <ImageUploadSlot
                  label="Mobile"
                  sublabel="{{IMAGE_MOBILE}}"
                  imagePath={draft.image_path_mobile}
                  uploadState={mobileUpload}
                  inputRef={mobileInputRef}
                  onUpload={(e) => handleImageUpload(e, 'mobile')}
                  onClear={() => {
                    updateDraft('image_path_mobile', '');
                    updateDraft('image_blur_mobile', '');
                  }}
                />
              </div>
            </Card>

            {/* HTML 카드 */}
            <Card
              title="배너 HTML 파일"
              subtitle={
                <>
                  2단계 — 1단계 배경 이미지 위에 텍스트를 입힌 production HTML 을 등록합니다.
                  <br />
                  디자이너가 작성한 responsive.html (모든 BP 시각 검증된 데모) 을 별도 Claude Code 인스턴스에서 production HTML 로 변환해 주세요. iframe sandbox 모델 + 미디어쿼리 + placeholder 4종을 자동 적용하는 변환 규칙입니다.
                  <br />
                  받은 코드는 .html 파일로 저장해 올리거나, 코드를 그대로 복사해서 '텍스트 붙여넣기' 로 등록할 수 있어요. 이미지가 들어갈 자리는 등록 후 자동으로 채워지고, 보안을 위해 외부 스크립트는 차단됩니다.
                </>
              }
            >
              <div className="flex flex-col gap-3">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!h-8"
                    onClick={() => setHtmlTextOpen((v) => !v)}
                    disabled={htmlUpload.status === 'uploading'}
                  >
                    {htmlTextOpen ? '텍스트 입력 닫기' : '또는 텍스트 붙여넣기'}
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
                {htmlTextOpen && (
                  <div className="flex flex-col gap-2 mt-1">
                    <textarea
                      value={htmlText}
                      onChange={(e) => setHtmlText(e.target.value)}
                      placeholder="<!DOCTYPE html>&#10;<html>&#10;  ..."
                      rows={10}
                      spellCheck={false}
                      className="font-mono text-xs px-3 py-2 rounded-md border border-input bg-[var(--surface)] resize-y min-h-[200px]"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="!h-8"
                        onClick={handleHtmlTextUpload}
                        disabled={htmlUpload.status === 'uploading' || !htmlText.trim()}
                      >
                        {htmlUpload.status === 'uploading' ? '업로드 중…' : '텍스트 업로드'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="!h-8 !text-xs"
                        onClick={() => { setHtmlText(''); setHtmlTextOpen(false); }}
                      >
                        취소
                      </Button>
                      <span className="text-xs text-[var(--foreground-muted)] ml-auto">
                        AI 작성 코드 블록 복사 후 그대로 붙여넣기
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* aspect-ratio 카드 · S239 read-only 표시 */}
            <Card
              title="iframe 컨테이너 비율"
              subtitle="이미지를 등록하면 자동으로 측정·입력됩니다. 표시 전용이라 직접 수정할 수 없어요."
            >
              <div className="grid grid-cols-3 gap-3">
                <AspectInput
                  label="Desktop (≥1024px)"
                  value={draft.aspect_desktop}
                />
                <AspectInput
                  label="Tablet (768~1023px)"
                  value={draft.aspect_tablet}
                />
                <AspectInput
                  label="Mobile (<768px)"
                  value={draft.aspect_mobile}
                />
              </div>
            </Card>

            {/* 검색·접근성 메타 카드 — iframe 외부 sr-only 출력 + alt (064) */}
            <Card
              title="검색 · 접근성 메타 텍스트"
              subtitle={
                <>
                  iframe 안 텍스트는 검색엔진과 스크린리더에서 분리된 영역으로 인식돼요.
                  <br />
                  같은 내용을 여기 별도로 입력하면 화면에는 변화 없이 검색·낭독에서만 인식됩니다. 빈 값은 출력되지 않아요.
                </>
              }
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
                <FormField label="헤드라인 (검색용 h2)">
                  <FormInput
                    value={draft.headline_text}
                    maxLength={80}
                    onChange={(e) => updateDraft('headline_text', e.target.value)}
                    placeholder="예: UBE 시리즈 오픈"
                  />
                </FormField>
                <FormField label="부제 (검색용 p)">
                  <FormInput
                    value={draft.subhead_text}
                    maxLength={200}
                    onChange={(e) => updateDraft('subhead_text', e.target.value)}
                    placeholder="예: 자색 고구마 라떼 등 시즌 한정 5종"
                  />
                </FormField>
                <div className="grid grid-cols-[1fr_2fr] gap-3">
                  <FormField label="CTA 라벨">
                    <FormInput
                      value={draft.cta_text}
                      maxLength={30}
                      onChange={(e) => updateDraft('cta_text', e.target.value)}
                      placeholder="예: 메뉴 보기"
                    />
                  </FormField>
                  <FormField label="CTA 링크">
                    <FormInput
                      value={draft.cta_href}
                      maxLength={500}
                      onChange={(e) => updateDraft('cta_href', e.target.value)}
                      placeholder="예: /cafe · 비워두면 텍스트만 노출"
                    />
                  </FormField>
                </div>
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

/* ── Image Upload Slot ──────────────────────────────────────────────────── */

function ImageUploadSlot({
  label,
  sublabel,
  required,
  imagePath,
  uploadState,
  inputRef,
  onUpload,
  onClear,
}: {
  label: string;
  sublabel: string;
  required?: boolean;
  imagePath: string;
  uploadState: UploadState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
        <span className="text-[var(--foreground-muted)] font-mono font-normal ml-1 text-[10px]">
          {sublabel}
        </span>
      </div>
      {imagePath ? (
        <div
          className="rounded-md overflow-hidden border border-border aspect-video bg-cover bg-center relative"
          style={{ backgroundImage: `url("${imagePath}")` }}
        >
          <button
            type="button"
            onClick={onClear}
            aria-label={`${label} 이미지 제거`}
            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-[var(--danger)] hover:bg-white shadow-sm cursor-pointer p-0 border-none"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <div
          className="rounded-md overflow-hidden border border-border aspect-video flex items-center justify-center text-[var(--foreground-muted)] text-xs"
          style={{
            background:
              'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 6px, var(--placeholder-pattern-2) 6px 12px)',
          }}
        >
          이미지 없음
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/webp,image/avif,image/jpeg,image/png"
        onChange={onUpload}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="!h-8 w-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploadState.status === 'uploading'}
      >
        {uploadState.status === 'uploading'
          ? '업로드 중…'
          : imagePath
            ? '이미지 변경'
            : '파일 선택'}
      </Button>
      {uploadState.status === 'error' && (
        <div className="px-2.5 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
          {uploadState.message}
        </div>
      )}
    </div>
  );
}

/* ── Aspect Display (read-only · S239) ─────────────────────────────────────
   이미지 업로드 시 naturalWidth/Height 가 자동 측정되어 값이 채워짐.
   운영자가 직접 수정하면 iframe 컨테이너 비율 ↔ 실 이미지 비율 불일치로
   화면이 stretch/squash 될 위험. 따라서 표시 전용으로 전환. 비율 정보 자체는
   AI prompt 에 들어가므로 운영자가 확인할 수 있어야 함. */

function AspectInput({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const display = formatAspectDisplay(value);
  return (
    <FormField
      label={label}
      hint={value ? '이미지 업로드 시 자동 측정된 값입니다.' : '이미지를 먼저 등록해 주세요.'}
    >
      <div className="px-3 py-2 rounded-md border border-input bg-[var(--surface-muted)] text-sm font-mono text-foreground select-text">
        {display}
      </div>
    </FormField>
  );
}

/** "2008/783" → "2008px x 783px" · 빈 값 → "—" · 형식 오류 → 원본 그대로. */
function formatAspectDisplay(value: string): string {
  if (!value) return '—';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!m) return value;
  return `${m[1]}px x ${m[2]}px`;
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
  event: CafeEventBanner;
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

function shallowEqualEvent(a: CafeEventBanner, b: CafeEventBanner): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.enabled === b.enabled &&
    a.custom_html_path === b.custom_html_path &&
    a.image_path_desktop === b.image_path_desktop &&
    a.image_path_tablet === b.image_path_tablet &&
    a.image_path_mobile === b.image_path_mobile &&
    a.image_blur_desktop === b.image_blur_desktop &&
    a.image_blur_tablet === b.image_blur_tablet &&
    a.image_blur_mobile === b.image_blur_mobile &&
    a.aspect_desktop === b.aspect_desktop &&
    a.aspect_tablet === b.aspect_tablet &&
    a.aspect_mobile === b.aspect_mobile &&
    a.image_alt === b.image_alt &&
    a.headline_text === b.headline_text &&
    a.subhead_text === b.subhead_text &&
    a.cta_text === b.cta_text &&
    a.cta_href === b.cta_href &&
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
    image_path_desktop: draft.image_path_desktop,
    image_path_tablet: draft.image_path_tablet,
    image_path_mobile: draft.image_path_mobile,
    aspect_desktop: draft.aspect_desktop,
    aspect_tablet: draft.aspect_tablet,
    aspect_mobile: draft.aspect_mobile,
    image_alt: draft.image_alt,
    headline_text: draft.headline_text,
    subhead_text: draft.subhead_text,
    cta_text: draft.cta_text,
    cta_href: draft.cta_href,
  });
  return `/preview/cafe-event?${params.toString()}`;
}

/** File 의 naturalWidth/Height 측정 → "W/H" 문자열. 실패 시 reject. */
function measureImageAspect(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w > 0 && h > 0) resolve(`${w}/${h}`);
      else reject(new Error('invalid dimension'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

function summarizeUrl(url: string): string {
  const parts = url.split('/');
  const name = parts[parts.length - 1] ?? url;
  return name.length > 36 ? `${name.slice(0, 32)}…` : name;
}


/* ── 공용 컴포넌트 ─────────────────────────────────── */

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  /** string · JSX 모두 허용 (의미 단위 줄바꿈 시 fragment + <br/> 사용). */
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** 우측 상단 액션 슬롯 (예: AI prompt 복사 버튼). */
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="m-0 text-sm font-medium">{title}</h3>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5 leading-relaxed">{subtitle}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
