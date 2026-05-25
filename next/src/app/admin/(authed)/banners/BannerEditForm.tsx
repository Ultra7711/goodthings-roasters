'use client';

/* ══════════════════════════════════════════════════════════════════════════
   BannerEditForm — /admin/banners/new + /admin/banners/[id]/edit 공용 (S273)

   책임:
   - 단일 Banner row 의 폼 — kind 무관 (cafe_event / signature 동일)
   - 이미지 3종 + HTML 업로드 + 검색/접근성 메타 + 기간 + internal_label
   - 4 brk iframe 라이브 미리보기 (/preview/banner?kind=...)
   - 저장/삭제/취소 → /admin/banners?kind=... 복귀

   답습:
   - CafeEventsForm.tsx detail 영역 (line 488~872) + helper 컴포넌트
   - master-detail 제거 / type chip 제거 / activeConflict 제거
   - internal_label 입력 필드 신설
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { describeError, describeUploadError } from '@/lib/admin/errorDescribe';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import ConfirmModal from '@/components/admin/ConfirmModal';
import type { Banner, BannerKind } from '@/lib/banners';
import { uploadBannerHtml } from '@/lib/admin/uploadBannerHtml';
import { buildBannerAiPrompt, buildStage2Prompt } from '@/lib/admin/aiPrompt';
import {
  uploadBannerImage,
  type BannerBreakpoint,
} from '@/lib/admin/uploadBannerImage';
import {
  convertResponsiveHtmlAction,
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
} from './actions';

/* ── Constants ─────────────────────────────────────────────────────────── */

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

const KIND_LABEL: Record<BannerKind, string> = {
  cafe_event: '카페 배너',
  signature: '시그니처 배너',
};

/* ── Types ─────────────────────────────────────────────────────────────── */

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

type Draft = Banner;

interface BannerEditFormProps {
  mode: 'create' | 'edit';
  kind: BannerKind;
  /** mode='edit' 시 필수 / mode='create' 시 null. */
  banner: Banner | null;
  /** mode='create' 시 list 의 마지막+1 으로 자동 부여될 sort_order. */
  defaultSortOrder?: number;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function BannerEditForm({
  mode,
  kind,
  banner,
  defaultSortOrder = 0,
}: BannerEditFormProps) {
  const router = useRouter();
  const isNew = mode === 'create';
  const initialDraft: Draft = banner ?? createEmptyBanner(kind, defaultSortOrder);

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [original, setOriginal] = useState<Draft>(initialDraft);
  const [isPending, startTransition] = useTransition();
  const [htmlUpload, setHtmlUpload] = useState<UploadState>({ status: 'idle' });
  const [desktopUpload, setDesktopUpload] = useState<UploadState>({ status: 'idle' });
  const [tabletUpload, setTabletUpload] = useState<UploadState>({ status: 'idle' });
  const [mobileUpload, setMobileUpload] = useState<UploadState>({ status: 'idle' });
  const [htmlTextOpen, setHtmlTextOpen] = useState(false);
  const [htmlText, setHtmlText] = useState('');
  const [responsiveText, setResponsiveText] = useState('');
  const [responsiveOpen, setResponsiveOpen] = useState(false);
  const [autoConvert, setAutoConvert] = useState<UploadState>({ status: 'idle' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() => buildPreviewSrc(draft));
  const [previewHeight, setPreviewHeight] = useState<number>(480);

  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const responsiveInputRef = useRef<HTMLInputElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const tabletInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = !shallowEqual(original, draft);

  /* draft 변경 시 300ms debounce 후 preview src 갱신. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewSrc(buildPreviewSrc(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);

  /* iframe height postMessage 수신. */
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

  /* ── Handlers ─────────────────────────────────────────────────────── */

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    if (isNew) {
      router.push(`/admin/banners?kind=${kind}`);
      return;
    }
    setDraft(original);
  }

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    brk: BannerBreakpoint,
  ) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const setState =
      brk === 'desktop' ? setDesktopUpload : brk === 'tablet' ? setTabletUpload : setMobileUpload;
    const fieldKey =
      brk === 'desktop' ? 'image_path_desktop' : brk === 'tablet' ? 'image_path_tablet' : 'image_path_mobile';
    const blurKey =
      brk === 'desktop' ? 'image_blur_desktop' : brk === 'tablet' ? 'image_blur_tablet' : 'image_blur_mobile';
    const aspectKey =
      brk === 'desktop' ? 'aspect_desktop' : brk === 'tablet' ? 'aspect_tablet' : 'aspect_mobile';

    setState({ status: 'uploading', fileName: file.name });
    const aspect = await measureImageAspect(file).catch(() => null);
    const result = await uploadBannerImage(file, kind, brk);
    if (result.ok) {
      updateDraft(fieldKey, result.publicUrl);
      updateDraft(blurKey, result.blurDataURL ?? '');
      if (aspect) updateDraft(aspectKey, aspect);
      setState({ status: 'idle' });
      toast.success('이미지를 등록했습니다', {
        description: aspect
          ? `비율 ${aspect} 자동 입력 · 저장 후 사이트 반영`
          : '저장 후 사이트 반영',
      });
    } else {
      const message = describeUploadError(result.error, result.detail);
      setState({ status: 'error', message });
      toast.error(message);
    }
  }

  /**
   * HTML 텍스트로부터 SEO 메타 자동 추출 → 빈 필드만 채움.
   * 운영자 입력 보존 — 이미 값이 있는 필드는 건드리지 않음.
   * 적용 후 채워진 항목 list 반환 (toast 안내용).
   */
  function autofillMetaFromHtml(html: string): string[] {
    const extracted = extractMetaFromHtml(html);
    const filled: string[] = [];
    setDraft((prev) => {
      const next = { ...prev };
      if (!prev.image_alt.trim() && extracted.image_alt) {
        next.image_alt = extracted.image_alt;
        filled.push('alt');
      }
      if (!prev.headline_text.trim() && extracted.headline_text) {
        next.headline_text = extracted.headline_text;
        filled.push('헤드라인');
      }
      if (!prev.subhead_text.trim() && extracted.subhead_text) {
        next.subhead_text = extracted.subhead_text;
        filled.push('부제');
      }
      if (!prev.cta_text.trim() && extracted.cta_text) {
        next.cta_text = extracted.cta_text;
        filled.push('CTA 라벨');
      }
      if (!prev.cta_href.trim() && extracted.cta_href) {
        next.cta_href = extracted.cta_href;
        filled.push('CTA 링크');
      }
      return next;
    });
    return filled;
  }

  /**
   * 디자이너 responsive HTML 텍스트 → server action 자동 변환 → production HTML 저장.
   * - 성공 시 custom_html_path 자동 채움 + autofill 동시 실행
   * - warnings (BP wrap 누락 등) toast.warning 으로 안내 (실패 아님)
   * - 변환 실패 시 기존 manual 경로 (HTML 파일 선택 / 텍스트 붙여넣기) fallback 안내
   */
  async function handleResponsiveConvert(responsiveHtml: string) {
    const trimmed = responsiveHtml.trim();
    if (!trimmed) {
      toast.error('responsive HTML 을 입력해 주세요');
      return;
    }
    setAutoConvert({ status: 'uploading', fileName: 'responsive.html' });
    const result = await convertResponsiveHtmlAction(trimmed);
    if (!result.ok) {
      const message =
        result.detail ||
        (result.error === 'unauthorized'
          ? '권한이 없습니다'
          : result.error === 'too_large'
          ? '파일이 너무 큽니다'
          : result.error === 'invalid_input'
          ? '입력 텍스트가 부족합니다'
          : '변환에 실패했습니다');
      setAutoConvert({ status: 'error', message });
      toast.error(message, {
        description: '아래 manual 경로 (HTML 파일 선택 / 텍스트 붙여넣기) 로 직접 등록할 수 있습니다',
      });
      return;
    }

    const blob = new Blob([result.productionHtml], { type: 'text/html' });
    const file = new File([blob], 'banner.html', { type: 'text/html' });
    const upload = await uploadBannerHtml(file, kind);
    if (!upload.ok) {
      const message = describeUploadError(upload.error, upload.detail);
      setAutoConvert({ status: 'error', message });
      toast.error(message);
      return;
    }

    updateDraft('custom_html_path', upload.publicUrl);
    setAutoConvert({ status: 'idle' });
    setResponsiveText('');
    setResponsiveOpen(false);

    const filled = autofillMetaFromHtml(trimmed);
    const baseDescription =
      filled.length > 0
        ? `${filled.join(' · ')} 자동 입력 · 미리보기에 즉시 반영`
        : '미리보기에 즉시 반영 · SEO 메타는 빈 채로 남아 있습니다';
    if (result.warnings.length > 0) {
      toast.warning('자동 변환 완료 (경고 포함)', {
        description: `${baseDescription}\n경고: ${result.warnings.join(' · ')}`,
      });
    } else {
      toast.success('자동 변환 완료', { description: baseDescription });
    }
  }

  /**
   * Stage 2 AI prompt (S276) clipboard 복사.
   * 운영자가 Claude.ai 에 prompt + Stage 1 결과 이미지를 던지면 responsive HTML 생성.
   * 결과를 위 "responsive HTML 자동 변환" 카드에 붙여넣기 → production HTML 자동 저장.
   */
  async function handleStage2PromptCopy() {
    const prompt = buildStage2Prompt({
      kind: kind === 'cafe_event' ? 'cafe-event' : 'signature',
      aspectDesktop: draft.aspect_desktop,
      aspectTablet: draft.aspect_tablet,
      aspectMobile: draft.aspect_mobile,
      headlineText: draft.headline_text,
      subheadText: draft.subhead_text,
      ctaText: draft.cta_text,
      imageAlt: draft.image_alt,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Stage 2 prompt 를 복사했습니다', {
        description: 'Claude.ai 에 prompt + Stage 1 배경 이미지 던지기 → responsive HTML 받기 → 위 자동 변환에 붙여넣기',
      });
    } catch {
      toast.error('복사에 실패했습니다 — 수동으로 복사해 주세요');
    }
  }

  /**
   * 현재 등록된 production HTML 을 .html 파일로 다운로드 (디자이너 검수 옵션).
   * Storage 의 custom_html_path 를 fetch 후 blob 다운로드.
   */
  async function handleHtmlDownload() {
    const url = draft.custom_html_path.trim();
    if (!url) {
      toast.error('등록된 HTML 이 없습니다');
      return;
    }
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `banner-${kind}-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('HTML 을 다운로드했습니다', {
        description: '디자이너 검수 후 다시 위 자동 변환 또는 수동 업로드로 등록해 주세요',
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : '다운로드 실패';
      toast.error(`HTML 다운로드 실패 — ${message}`);
    }
  }

  async function handleResponsiveFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch {
      toast.error('파일을 읽지 못했습니다');
      return;
    }
    await handleResponsiveConvert(text);
  }

  async function handleHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    /* 업로드 전에 HTML 텍스트 read — 자동 추출용. */
    let htmlContent = '';
    try {
      htmlContent = await file.text();
    } catch {
      /* read 실패해도 업로드는 계속. 자동 추출만 skip. */
    }
    const result = await uploadBannerHtml(file, kind);
    if (result.ok) {
      updateDraft('custom_html_path', result.publicUrl);
      setHtmlUpload({ status: 'idle' });
      const filled = htmlContent ? autofillMetaFromHtml(htmlContent) : [];
      toast.success('HTML 파일을 등록했습니다', {
        description:
          filled.length > 0
            ? `${filled.join(' · ')} 자동 입력`
            : undefined,
      });
    } else {
      const message = describeUploadError(result.error, result.detail);
      setHtmlUpload({ status: 'error', message });
      toast.error(message);
    }
  }

  async function handleHtmlTextUpload() {
    const text = htmlText.trim();
    if (!text) {
      toast.error('HTML 텍스트를 붙여넣어 주세요');
      return;
    }
    const blob = new Blob([text], { type: 'text/html' });
    const file = new File([blob], 'banner.html', { type: 'text/html' });

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadBannerHtml(file, kind);
    if (result.ok) {
      updateDraft('custom_html_path', result.publicUrl);
      setHtmlUpload({ status: 'idle' });
      const filled = autofillMetaFromHtml(text);
      setHtmlText('');
      setHtmlTextOpen(false);
      toast.success('HTML 텍스트를 등록했습니다', {
        description:
          filled.length > 0
            ? `${filled.join(' · ')} 자동 입력`
            : undefined,
      });
    } else {
      const message = describeUploadError(result.error, result.detail);
      setHtmlUpload({ status: 'error', message });
      toast.error(message);
    }
  }

  function handleSave() {
    startTransition(async () => {
      if (isNew) {
        const { id: _, ...input } = draft;
        /* createBannerAction success → server-side redirect (NEXT_REDIRECT throw)
           → 자동 navigate + ?just_created=1. result 는 실패 시만 반환. */
        const result = await createBannerAction(input);
        if (!result.ok) {
          toast.error(describeError(result.error, result.detail));
        }
      } else {
        const result = await updateBannerAction(draft);
        if (result.ok) {
          toast.success('배너를 저장했습니다', {
            description: '사이트에 즉시 반영됩니다',
          });
          /* 저장 직후 isDirty=false 로 [변경 취소] / [변경사항 저장] 버튼 비활성화.
             router.refresh() 가 server data 새로 받아도 useState 로 잡힌 original 은
             remount 없으면 갱신 안 됨 → 명시적 sync 필요. */
          setOriginal(draft);
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      }
    });
  }

  function confirmDelete() {
    if (isNew) return;
    startTransition(async () => {
      const result = await deleteBannerAction({ id: draft.id, kind: draft.kind });
      if (result.ok) {
        toast.success('배너를 삭제했습니다');
        setDeleteConfirmOpen(false);
        /* router.push 가 stale RSC payload 사용하는 회귀 회피 — full reload.
           편집 → 삭제 → list 진입 흐름은 빈도 낮음 (SPA 손상 미미). */
        window.location.href = `/admin/banners?kind=${kind}`;
      } else {
        toast.error(describeError(result.error, result.detail));
      }
    });
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div>
      <AdminTopbarActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7"
          disabled={(!isNew && !isDirty) || isPending}
          onClick={handleReset}
        >
          {isNew ? '취소' : '변경 취소'}
        </Button>
        <Button
          type="button"
          size="sm"
          className="!h-7"
          disabled={(!isNew && !isDirty) || isPending}
          onClick={handleSave}
        >
          {isPending ? (isNew ? '등록 중…' : '저장 중…') : isNew ? '배너 등록' : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      <AdminBackLink
        href={`/admin/banners?kind=${kind}`}
        label="배너 목록으로"
      />

      {/* 헤더 — 타이틀 좌 / 식별 라벨 우 (PDP/menu edit 답습) */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap min-w-0">
            <h2 className="m-0 text-2xl font-medium tracking-tight">
              {isNew ? `${KIND_LABEL[kind]} 등록` : `${KIND_LABEL[kind]} 편집`}
            </h2>
            {!isNew && draft.internal_label.trim() && (
              <span className="gtr-mono text-sm text-muted-foreground">
                {draft.internal_label}
              </span>
            )}
          </div>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {isNew
            ? '이미지 + HTML 등록 후 list 가장 뒤에 추가됩니다. 1번 카드가 사이트에 노출되며 순서는 list 페이지에서 화살표로 조정합니다.'
            : '편집한 내용은 저장 시 즉시 사이트에 반영됩니다.'}
        </div>
      </div>

      <div className="min-w-0">
        {/* 기본 정보 카드 */}
        <Card title="기본 정보" subtitle="식별 라벨 (운영자용) + 활성 여부">
          <div className="flex flex-col gap-3">
            <FormField
              label="운영자 식별 라벨"
              hint="list 카드에 표시 · 사이트에는 노출되지 않습니다. 예: 봄 시즌 콜라보 2026"
            >
              <FormInput
                value={draft.internal_label}
                maxLength={120}
                onChange={(e) => updateDraft('internal_label', e.target.value)}
                placeholder="예: 봄 시즌 콜라보 2026"
              />
            </FormField>
            <FormField label="활성">
              <label className="flex gap-2 items-center h-[34px] cursor-pointer">
                <Checkbox
                  checked={draft.enabled}
                  onCheckedChange={(v) => updateDraft('enabled', v === true)}
                />
                <span className="text-sm">
                  {draft.enabled ? '활성 (1번 카드일 때 사이트 노출)' : '비활성 (사이트 미노출)'}
                </span>
              </label>
            </FormField>
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
              데스크탑 · 모바일 2장만 등록하시는 것을 권장해요. 태블릿은 비우면 데스크탑 이미지를 자동으로 사용합니다.
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
                  kind: kind === 'cafe_event' ? 'cafe-event' : 'signature',
                  aspectDesktop: draft.aspect_desktop,
                  aspectTablet: draft.aspect_tablet,
                  aspectMobile: draft.aspect_mobile,
                });
                try {
                  await navigator.clipboard.writeText(prompt);
                  toast.success('AI prompt 를 복사했습니다');
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

        {/* responsive HTML 자동 변환 카드 (S275 + S276 Stage 2 prompt) */}
        <Card
          title="responsive HTML 자동 변환 (선택)"
          subtitle={
            <>
              디자이너 4 BP responsive HTML 을 production HTML 로 자동 변환합니다.
              <br />
              디자이너에게 의뢰하는 대신 'Stage 2 AI prompt 복사' 버튼으로 Claude.ai 에 의뢰할 수도 있어요.
              <br />
              변환 성공 시 아래 'production HTML' 영역에 자동 저장됩니다. 실패 시 아래 manual 업로드로 직접 등록할 수 있어요.
            </>
          }
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="!h-7 !text-xs"
              onClick={handleStage2PromptCopy}
            >
              <Copy size={14} />
              Stage 2 AI prompt 복사
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={responsiveInputRef}
                type="file"
                accept=".html,.htm,text/html"
                onChange={handleResponsiveFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8"
                onClick={() => responsiveInputRef.current?.click()}
                disabled={autoConvert.status === 'uploading'}
              >
                {autoConvert.status === 'uploading' ? '변환 중…' : 'responsive HTML 파일 선택'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-8"
                onClick={() => setResponsiveOpen((v) => !v)}
                disabled={autoConvert.status === 'uploading'}
              >
                {responsiveOpen ? '텍스트 입력 닫기' : '또는 텍스트 붙여넣기'}
              </Button>
              <span className="text-xs text-[var(--foreground-muted)]">
                4 BP wrap (landscape-max / landscape-min / portrait-max / portrait-min) · 2MB 이하
              </span>
            </div>
            {autoConvert.status === 'error' && (
              <div className="px-2.5 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
                {autoConvert.message}
              </div>
            )}
            {responsiveOpen && (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={responsiveText}
                  onChange={(e) => setResponsiveText(e.target.value)}
                  placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head> ... </head>&#10;  <body>&#10;    <div class=&quot;banner-wrap landscape-max-wrap&quot;> ... </div>&#10;    ..."
                  rows={10}
                  spellCheck={false}
                  className="font-mono text-xs px-3 py-2 rounded-md border border-input bg-[var(--surface)] resize-y min-h-[200px]"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="!h-8"
                    onClick={() => handleResponsiveConvert(responsiveText)}
                    disabled={autoConvert.status === 'uploading' || !responsiveText.trim()}
                  >
                    {autoConvert.status === 'uploading' ? '변환 중…' : '자동 변환 실행'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="!h-8 !text-xs"
                    onClick={() => {
                      setResponsiveText('');
                      setResponsiveOpen(false);
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* HTML 카드 */}
        <Card
          title="배너 HTML 파일"
          subtitle={
            <>
              위 자동 변환을 사용하지 않거나 디자이너에게 직접 production HTML 을 받은 경우 여기에 등록합니다.
              <br />
              운영자가 작성한 .html 파일 또는 텍스트를 그대로 붙여넣기 할 수 있어요. 보안을 위해 외부 스크립트는 차단됩니다.
              <br />
              자동 변환 결과는 위 영역에서 처리되며, 이 영역의 등록값은 자동 변환 시 덮어쓰여집니다.
            </>
          }
          action={
            draft.custom_html_path ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7 !text-xs"
                onClick={handleHtmlDownload}
              >
                <Download size={14} />
                HTML 다운로드
              </Button>
            ) : undefined
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
                    onClick={() => {
                      setHtmlText('');
                      setHtmlTextOpen(false);
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* aspect 카드 */}
        <Card
          title="iframe 컨테이너 비율"
          subtitle="이미지를 등록하면 자동으로 측정·입력됩니다."
        >
          <div className="grid grid-cols-3 gap-3">
            <AspectInput label="Desktop (≥1024px)" value={draft.aspect_desktop} />
            <AspectInput label="Tablet (768~1023px)" value={draft.aspect_tablet} />
            <AspectInput label="Mobile (<768px)" value={draft.aspect_mobile} />
          </div>
        </Card>

        {/* 검색·접근성 메타 카드 */}
        <Card
          title="검색 · 접근성 메타 텍스트"
          subtitle={
            <>
              iframe 안 텍스트는 검색·낭독에서 분리됩니다. 동일 내용을 여기 입력하면 화면 변화 없이 검색·낭독에서만 인식됩니다.
              <br />
              HTML 등록 시 빈 항목은 자동으로 채워집니다.
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <FormField label="대체 텍스트 (alt · iframe title)" required>
              <FormInput
                value={draft.image_alt}
                maxLength={120}
                onChange={(e) => updateDraft('image_alt', e.target.value)}
                placeholder="예: UBE 시리즈 배너"
              />
            </FormField>
            <FormField label="헤드라인 (검색용 h2)">
              <FormInput
                value={draft.headline_text}
                maxLength={80}
                onChange={(e) => updateDraft('headline_text', e.target.value)}
              />
            </FormField>
            <FormField label="부제 (검색용 p)">
              <FormInput
                value={draft.subhead_text}
                maxLength={200}
                onChange={(e) => updateDraft('subhead_text', e.target.value)}
              />
            </FormField>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField label="CTA 라벨">
                <FormInput
                  value={draft.cta_text}
                  maxLength={30}
                  onChange={(e) => updateDraft('cta_text', e.target.value)}
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
        <Card title="기간" subtitle="ISO 날짜 (YYYY-MM-DD) · 빈 값 = 무제한">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="시작일" hint="비워두면 무제한 시작">
              <FormInput
                type="date"
                value={draft.start_date}
                onChange={(e) => updateDraft('start_date', e.target.value)}
              />
            </FormField>
            <FormField label="종료일" hint="비워두면 무제한 종료">
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

        {/* 삭제 (편집 모드만) */}
        {!isNew && (
          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!h-8 !text-[var(--danger)] hover:!bg-[var(--danger-soft)]"
              disabled={isPending}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 size={14} />
              이 배너 삭제
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteConfirmOpen}
        variant="danger"
        title="배너를 삭제하시겠습니까?"
        description="이 배너는 영원히 사라지며, 되돌릴 수 없습니다."
        confirmLabel="삭제"
        pending={isPending}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function createEmptyBanner(kind: BannerKind, sortOrder: number): Banner {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    kind,
    enabled: true,
    internal_label: '',
    custom_html_path: '',
    image_path_desktop: '',
    image_path_tablet: '',
    image_path_mobile: '',
    image_blur_desktop: '',
    image_blur_tablet: '',
    image_blur_mobile: '',
    aspect_desktop: kind === 'cafe_event' ? '1320/480' : '1320/600',
    aspect_tablet: '1024/520',
    aspect_mobile: kind === 'cafe_event' ? '390/640' : '390/520',
    image_alt: '',
    headline_text: '',
    subhead_text: '',
    cta_text: '',
    cta_href: '',
    start_date: '',
    end_date: '',
    sort_order: sortOrder,
  };
}

function shallowEqual(a: Banner, b: Banner): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.enabled === b.enabled &&
    a.internal_label === b.internal_label &&
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

function buildPreviewSrc(draft: Banner): string {
  const params = new URLSearchParams({
    kind: draft.kind,
    enabled: String(draft.enabled),
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
  return `/preview/banner?${params.toString()}`;
}

function measureImageAspect(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
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

interface ExtractedMeta {
  image_alt: string;
  headline_text: string;
  subhead_text: string;
  cta_text: string;
  cta_href: string;
}

/**
 * 운영자 production HTML 에서 SEO 메타 자동 추출.
 * 빈 문자열이면 caller 가 자동 채우기 skip — 기존 입력 보존.
 *
 * 추출 규칙:
 *   - h1 또는 h2 의 첫 element textContent → headline_text
 *   - h1/h2 직후의 p (또는 가장 첫 p) → subhead_text
 *   - a 의 첫 element textContent → cta_text · href → cta_href
 *   - img[alt] 첫 alt 속성 → image_alt
 */
function extractMetaFromHtml(html: string): ExtractedMeta {
  if (typeof window === 'undefined') {
    return { image_alt: '', headline_text: '', subhead_text: '', cta_text: '', cta_href: '' };
  }
  let doc: Document | null = null;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return { image_alt: '', headline_text: '', subhead_text: '', cta_text: '', cta_href: '' };
  }
  if (!doc) {
    return { image_alt: '', headline_text: '', subhead_text: '', cta_text: '', cta_href: '' };
  }

  const heading = doc.querySelector('h1, h2');
  const headline = heading?.textContent?.trim() ?? '';

  /* heading 직후 형제 p 우선 — 아니면 가장 첫 p. */
  let subhead = '';
  if (heading) {
    let sib = heading.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'P') {
        subhead = sib.textContent?.trim() ?? '';
        break;
      }
      sib = sib.nextElementSibling;
    }
  }
  if (!subhead) {
    subhead = doc.querySelector('p')?.textContent?.trim() ?? '';
  }

  const anchor = doc.querySelector('a');
  const ctaText = anchor?.textContent?.trim() ?? '';
  const ctaHref = anchor?.getAttribute('href')?.trim() ?? '';

  const imgWithAlt = doc.querySelector('img[alt]');
  const imageAlt = imgWithAlt?.getAttribute('alt')?.trim() ?? '';

  return {
    image_alt: imageAlt,
    headline_text: headline,
    subhead_text: subhead,
    cta_text: ctaText,
    cta_href: ctaHref,
  };
}

function formatAspectDisplay(value: string): string {
  if (!value) return '—';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!m) return value;
  return `${m[1]}px x ${m[2]}px`;
}

/* ── Sub-components ───────────────────────────────────────────────────── */

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
        {uploadState.status === 'uploading' ? '업로드 중…' : imagePath ? '이미지 변경' : '파일 선택'}
      </Button>
      {uploadState.status === 'error' && (
        <div className="px-2.5 py-2 rounded-md bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
          {uploadState.message}
        </div>
      )}
    </div>
  );
}

function AspectInput({ label, value }: { label: string; value: string }) {
  const display = formatAspectDisplay(value);
  return (
    <FormField
      label={label}
      hint={value ? '이미지 업로드 시 자동 측정' : '이미지를 먼저 등록해 주세요'}
    >
      <div className="px-3 py-2 rounded-md border border-input bg-[var(--surface-muted)] text-sm font-mono text-foreground select-text">
        {display}
      </div>
    </FormField>
  );
}

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
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h3 className="m-0 text-sm font-medium">미리보기</h3>
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
          title={`배너 미리보기 — ${previewBrk}`}
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

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="m-0 text-sm font-medium">{title}</h3>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5 leading-relaxed">
            {subtitle}
          </div>
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
      {hint && <div className="pl-2.5 text-xs text-[var(--foreground-muted)]">{hint}</div>}
    </div>
  );
}

function FormInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  const disabled = props.disabled === true;
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 h-[34px] border border-input rounded-md',
        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:border-ring',
        disabled ? 'bg-[var(--surface-muted)] opacity-70' : 'bg-[var(--surface)]',
      )}
    >
      <input
        {...props}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-[var(--foreground)] p-0 h-full shadow-none ring-0"
      />
    </div>
  );
}
