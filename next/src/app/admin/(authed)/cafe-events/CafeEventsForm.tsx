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
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
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

  function selectEvent(id: string) {
    if (isDirty && !confirm('저장되지 않은 변경이 사라집니다. 계속할까요?')) {
      return;
    }
    const ev = events.find((e) => e.id === id);
    setSelectedId(id);
    setDraft(ev ? { ...ev } : null);
  }

  function handleNew() {
    if (isDirty && !confirm('저장되지 않은 변경이 사라집니다. 계속할까요?')) {
      return;
    }
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
      toast.success('이미지가 업로드되었습니다 · 저장 후 반영됩니다');
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
          toast.success('이벤트가 생성되었습니다');
          setSelectedId(result.id);
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      } else {
        const result = await updateCafeEventAction(draft);
        if (result.ok) {
          toast.success('이벤트가 저장되었습니다 · B2C 사이트에 즉시 반영');
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      }
    });
  }

  function handleDelete() {
    if (!draft || isNew) return;
    if (!confirm(`"${draft.h4 || '이름 없음'}" 이벤트를 삭제할까요?`)) return;
    startTransition(async () => {
      const result = await deleteCafeEventAction(draft.id);
      if (result.ok) {
        toast.success('이벤트가 삭제되었습니다');
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
        {draft && !isNew && (
          <button
            type="button"
            style={SM_GHOST_DANGER}
            disabled={isPending}
            onClick={handleDelete}
          >
            삭제
          </button>
        )}
        <button
          type="button"
          style={{
            ...SM_GHOST,
            opacity: isDirty ? 1 : 0.4,
            cursor: isDirty ? 'pointer' : 'not-allowed',
          }}
          disabled={!isDirty || isPending}
          onClick={handleReset}
        >
          {isNew ? '취소' : '변경 취소'}
        </button>
        <button
          type="button"
          style={{
            ...SM_PRIMARY,
            opacity: isDirty && !isPending ? 1 : 0.5,
            cursor: isDirty && !isPending ? 'pointer' : 'not-allowed',
          }}
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? '저장 중…' : isNew ? '생성' : '변경사항 저장'}
        </button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div
        style={{
          marginBottom: 22,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
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
            카페 이벤트
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            메인 §2.5 카페 메뉴 chapter 의 이벤트 row · 동시 활성 max 1
          </div>
        </div>
      </div>

      {/* master-detail */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* List */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            position: 'sticky',
            top: 16,
          }}
        >
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>
              이벤트 {events.length}개
            </div>
            <button type="button" style={SM_SECONDARY} onClick={handleNew}>
              + 새 이벤트
            </button>
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {events.length === 0 && !draft && (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                }}
              >
                아직 등록된 이벤트가 없습니다.
              </div>
            )}
            {/* 신규 임시 row 도 list 상단에 표시 */}
            {isNew && draft && (
              <ListRow
                event={draft}
                selected
                isNew
                onClick={() => undefined}
              />
            )}
            {events.map((ev) => (
              <ListRow
                key={ev.id}
                event={ev}
                selected={selectedId === ev.id}
                isNew={false}
                onClick={() => selectEvent(ev.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!draft ? (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '60px 40px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--foreground-muted)',
              }}
            >
              좌측에서 이벤트를 선택하거나 [+ 새 이벤트] 를 눌러주세요.
            </div>
          ) : (
            <>
              {/* 동시 활성 충돌 경고 */}
              {activeConflict && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: 'var(--warning-soft)',
                    color: 'var(--warning)',
                    border: '1px solid var(--warning)',
                    fontSize: 12.5,
                  }}
                >
                  ⚠ 활성 충돌 — 같은 기간에 “{activeConflict.h4 || '이름 없음'}” 이 이미
                  활성 상태입니다. 동시 활성 max 1 (자문 §5.3) — 우선순위 높은 1개만 노출됩니다.
                </div>
              )}

              {/* 기본 정보 카드 */}
              <Card title="기본 정보" subtitle="이벤트 type · 활성 · 노출 정렬">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <FormField label="이벤트 type" required>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {CAFE_EVENT_TYPES.map((t) => {
                        const sel = draft.type === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleTypeChange(t)}
                            aria-pressed={sel}
                            style={{
                              padding: '5px 12px',
                              fontSize: 12,
                              fontWeight: 500,
                              borderRadius: 999,
                              background: sel ? 'var(--primary)' : 'var(--surface)',
                              color: sel ? '#fff' : 'var(--foreground-muted)',
                              border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--border)'),
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {TYPE_LABELS[t]}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
                    <FormField label="활성">
                      <label
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          height: 34,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(e) => updateDraft('enabled', e.target.checked)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: 13 }}>
                          {draft.enabled ? '활성 (B2C 노출 후보)' : '비활성 (저장만)'}
                        </span>
                      </label>
                    </FormField>
                    <FormField label="정렬 순서" hint="작은 값이 먼저 (동률 fallback)">
                      <FormInput
                        type="number"
                        value={String(draft.sort_order)}
                        onChange={(e) =>
                          updateDraft('sort_order', parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </Card>

              {/* 카피 카드 */}
              <Card title="카피" subtitle="자문 §3.2 — h4 max 22자 권고 · description max 80자 권고">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                        style={{
                          color:
                            draft.h4.length > H4_SOFT_LIMIT
                              ? 'var(--warning)'
                              : 'var(--foreground-muted)',
                        }}
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
                        style={{
                          color:
                            draft.description.length > DESC_SOFT_LIMIT
                              ? 'var(--warning)'
                              : 'var(--foreground-muted)',
                        }}
                      >
                        {draft.description.length}/{DESC_SOFT_LIMIT}자 권고 (max 160)
                      </span>
                    }
                  >
                    <textarea
                      value={draft.description}
                      maxLength={160}
                      onChange={(e) => updateDraft('description', e.target.value)}
                      style={TEXTAREA_STYLE}
                      placeholder="예: 부모님과 아이가 함께 방문하시면 음료 한 잔을 무료로 드립니다."
                    />
                  </FormField>
                </div>
              </Card>

              {/* 이미지 카드 */}
              <Card title="이미지" subtitle="1:1 정사각 권장 · 최대 5MB · webp/avif/jpeg/png">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 240px',
                    gap: 16,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                        style={{
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          aspectRatio: '1/1',
                          backgroundImage: `url("${draft.image_path}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          aspectRatio: '1/1',
                          background:
                            'repeating-linear-gradient(135deg, #EEEDEB 0 6px, #F5F4F2 6px 12px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--foreground-muted)',
                          fontSize: 11,
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
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadState.status === 'uploading'}
                      style={{
                        ...SM_SECONDARY,
                        width: '100%',
                        marginTop: 8,
                        opacity: uploadState.status === 'uploading' ? 0.6 : 1,
                        cursor:
                          uploadState.status === 'uploading' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {uploadState.status === 'uploading' ? '업로드 중…' : '이미지 변경'}
                    </button>
                    {uploadState.status === 'error' && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: 'var(--danger-soft)',
                          color: 'var(--danger)',
                          border: '1px solid var(--danger)',
                          fontSize: 11.5,
                        }}
                      >
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                  hint="비워두면 “자세히 →” 버튼 노출 안 함"
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
      </div>
    </>
  );
}

/* ── List Row ──────────────────────────────────────────────────────────── */

function ListRow({
  event,
  selected,
  isNew,
  onClick,
}: {
  event: CafeEvent;
  selected: boolean;
  isNew: boolean;
  onClick: () => void;
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
      ? 'Active'
      : status === 'coming'
        ? 'Coming'
        : status === 'past'
          ? 'Past'
          : '비활성';
  const statusColor =
    isNew
      ? 'var(--info)'
      : status === 'active'
        ? 'var(--success)'
        : status === 'coming'
          ? 'var(--info)'
          : status === 'past'
            ? 'var(--foreground-muted)'
            : 'var(--foreground-subtle)';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 14px',
        width: '100%',
        textAlign: 'left',
        background: selected ? 'var(--surface-muted)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'var(--foreground-muted)',
            border: '1px solid var(--border)',
          }}
        >
          {TYPE_LABELS[event.type]}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: statusColor,
            marginLeft: 'auto',
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--foreground)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {event.h4 || <span style={{ color: 'var(--foreground-muted)' }}>이름 없음</span>}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--foreground-muted)',
          fontFamily: 'monospace',
        }}
      >
        {event.start_date || '∞'} ~ {event.end_date || '∞'}
      </div>
    </button>
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
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
            EventBanner 미리보기
          </h3>
          <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
            저장 전 4 brk 검증 · 편집 중 즉시 반영
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PREVIEW_BRK_OPTIONS.map((opt) => {
            const sel = previewBrk === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSelectBrk(opt.key)}
                aria-pressed={sel}
                style={{
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  borderRadius: 6,
                  background: sel ? 'var(--primary)' : 'var(--surface)',
                  color: sel ? '#fff' : 'var(--foreground-muted)',
                  border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--border)'),
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}{' '}
                <span
                  style={{
                    opacity: 0.7,
                    marginLeft: 4,
                    fontFamily: 'monospace',
                    fontSize: 10,
                  }}
                >
                  {opt.width}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {isDirty && (
        <div
          style={{
            padding: '6px 18px',
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            fontSize: 11.5,
            borderBottom: '1px solid var(--border)',
          }}
        >
          저장되지 않은 변경 — 미리보기는 즉시 반영 · 저장 시 라이브 사이트 반영
        </div>
      )}
      <div
        style={{
          padding: 16,
          background: 'var(--surface-muted)',
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          justifyContent: 'flex-start',
        }}
      >
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
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하'}`;
    case 'unsupported_type':
      return `지원하지 않는 형식 — ${detail ?? 'webp/avif/jpeg/png 만 가능'}`;
    case 'unauthorized':
      return '업로드 권한이 없습니다. 다시 로그인해 주세요.';
    case 'public_url_failed':
      return '업로드는 됐지만 public URL 생성 실패. 다시 시도해 주세요.';
    case 'upload_failed':
    default:
      return `업로드 실패${detail ? ` — ${detail}` : ''}`;
  }
}

function describeError(error: string, detail?: string): string {
  switch (error) {
    case 'unauthorized':
      return '권한이 없습니다. 다시 로그인해 주세요.';
    case 'validation_failed':
      return `입력 검증 실패: ${detail ?? '필드 형식 확인 필요'}`;
    case 'not_found':
      return '이벤트를 찾을 수 없습니다 (이미 삭제되었을 수 있어요).';
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
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{title}</h3>
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--foreground)',
          letterSpacing: '-0.005em',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--primary)' }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{hint}</div>
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 34,
        background: disabled ? 'var(--surface-muted)' : 'var(--surface)',
        border: '1px solid var(--input)',
        borderRadius: 6,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {prefix && (
        <span style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>{prefix}</span>
      )}
      <input
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--foreground)',
          padding: 0,
          height: '100%',
        }}
      />
      {suffix && (
        <span style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>{suffix}</span>
      )}
    </div>
  );
}

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 64,
  resize: 'vertical',
  padding: '10px 12px',
  border: '1px solid var(--input)',
  borderRadius: 6,
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: 'inherit',
  color: 'var(--foreground)',
  outline: 'none',
  background: 'var(--surface)',
};

const SM_BASE: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  height: 28,
  gap: 5,
  borderRadius: 6,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.005em',
};

const SM_SECONDARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
};

const SM_GHOST: React.CSSProperties = {
  ...SM_BASE,
  background: 'transparent',
  color: 'var(--foreground-muted)',
  border: '1px solid transparent',
};

const SM_GHOST_DANGER: React.CSSProperties = {
  ...SM_BASE,
  background: 'transparent',
  color: 'var(--danger)',
  border: '1px solid transparent',
};

const SM_PRIMARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
