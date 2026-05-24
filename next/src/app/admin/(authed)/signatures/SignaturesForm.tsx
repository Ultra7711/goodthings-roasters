'use client';

/* ══════════════════════════════════════════
   SignaturesForm — /admin/signatures single row (S270 Phase 3b · 071 통합)

   책임:
   - signature kind 1 row 편집 폼 (partial UNIQUE 가 1 row 보장)
   - 운영자 .html 파일 업로드 (custom_html_path)
   - 이미지 3종 (desktop/tablet/mobile) 업로드 (banners/signature/images/{brk}/)
   - aspect-ratio 자동 측정 (이미지 dimension 기반)
   - 4 brk iframe 라이브 미리보기

   답습 source:
   - CafeEventsForm.tsx (master-detail · list 부분 제거 · type 필드 제거)
   - 폐기된 SignatureSubForm.tsx (settings 의 signature 카드)

   설계:
   - initialSignature null 시 신규 등록 (createBannerAction).
   - 존재 시 updateBannerAction. delete 차단 (DEC-S270 · enabled=false 만 가능).
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
import {
  uploadBannerImage,
  type BannerBreakpoint,
} from '@/lib/admin/uploadBannerImage';
import { uploadBannerHtml } from '@/lib/admin/uploadBannerHtml';
import { buildBannerAiPrompt } from '@/lib/admin/aiPrompt';
import type { SignatureBanner } from '@/lib/banners';
import {
  createBannerAction,
  updateBannerAction,
} from '../banners/actions';

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

const TEMP_ID = 'temp:signature';

/** 신규 등록 시 default. SignatureSettingsSchema (구) defaults 답습. */
const SIGNATURE_DEFAULTS: Omit<SignatureBanner, 'id'> = {
  kind: 'signature',
  enabled: false,
  custom_html_path: '',
  image_path_desktop: '',
  image_path_tablet: '',
  image_path_mobile: '',
  image_blur_desktop: '',
  image_blur_tablet: '',
  image_blur_mobile: '',
  aspect_desktop: '1320/600',
  aspect_tablet: '1024/520',
  aspect_mobile: '390/520',
  image_alt: '',
  headline_text: '',
  subhead_text: '',
  cta_text: '',
  cta_href: '',
  start_date: '',
  end_date: '',
  sort_order: 0,
};

/* ── Types ─────────────────────────────────────────────────────────────── */

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

type DraftSignature = SignatureBanner;

interface SignaturesFormProps {
  initialSignature: SignatureBanner | null;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function SignaturesForm({ initialSignature }: SignaturesFormProps) {
  const router = useRouter();
  const isNew = initialSignature === null;
  const [savedSignature, setSavedSignature] = useState<SignatureBanner | null>(
    initialSignature,
  );
  const [draft, setDraft] = useState<DraftSignature>(
    initialSignature ?? { id: TEMP_ID, ...SIGNATURE_DEFAULTS },
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
  const [previewSrc, setPreviewSrc] = useState<string>(() => buildPreviewSrc(draft));
  const [previewHeight, setPreviewHeight] = useState<number>(720);

  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const tabletInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  /* draft 변경 시 300ms debounce 후 iframe src 갱신 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewSrc(buildPreviewSrc(draft));
    }, 300);
    return () => clearTimeout(timer);
  }, [draft]);

  /* iframe 으로부터 chapter height 수신 (postMessage) */
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

  /* server fresh fetch → savedSignature 동기화. */
  useEffect(() => {
    setSavedSignature(initialSignature);
  }, [initialSignature]);

  const isDirty = useMemo(() => {
    if (isNew) {
      /* 신규 등록 시 default 와 다르면 dirty. */
      return !shallowEqualSignature(
        { id: TEMP_ID, ...SIGNATURE_DEFAULTS },
        draft,
      );
    }
    if (!savedSignature) return false;
    return !shallowEqualSignature(savedSignature, draft);
  }, [savedSignature, draft, isNew]);

  /* ── Handlers ─────────────────────────────────────────────────────── */

  function updateDraft<K extends keyof DraftSignature>(
    key: K,
    value: DraftSignature[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    if (savedSignature) setDraft(savedSignature);
    else setDraft({ id: TEMP_ID, ...SIGNATURE_DEFAULTS });
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
    try {
      const result = await uploadBannerImage(file, 'signature', brk);
      if (result.ok) {
        updateDraft(fieldKey, result.publicUrl);
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
    } catch (err) {
      /* S264-F L-1 답습 — Supabase storage / 네트워크 예외 시 status 영구
         'uploading' 잔존 방지. */
      const message = '업로드 중 예기치 못한 오류가 발생했습니다';
      setState({ status: 'error', message });
      toast.error(message);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[SignaturesForm] image upload threw', err);
      }
    }
  }

  async function handleHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    try {
      const result = await uploadBannerHtml(file, 'signature');
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
    } catch (err) {
      const message = '업로드 중 예기치 못한 오류가 발생했습니다';
      setHtmlUpload({ status: 'error', message });
      toast.error(message);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[SignaturesForm] html upload threw', err);
      }
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
    try {
      const result = await uploadBannerHtml(file, 'signature');
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
    } catch (err) {
      const message = '업로드 중 예기치 못한 오류가 발생했습니다';
      setHtmlUpload({ status: 'error', message });
      toast.error(message);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[SignaturesForm] html text upload threw', err);
      }
    }
  }

  function handleSave() {
    startTransition(async () => {
      if (isNew) {
        const { id: _, ...input } = draft;
        const result = await createBannerAction(input);
        if (result.ok) {
          toast.success('시그니처를 등록했습니다');
          /* TEMP_ID → 실 UUID 로 교체 + savedSignature 동기화. */
          setDraft((prev) => ({ ...prev, id: result.id }));
          setSavedSignature({ ...draft, id: result.id });
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
      } else {
        const result = await updateBannerAction(draft);
        if (result.ok) {
          toast.success('시그니처를 저장했습니다', {
            description: '사이트에 즉시 반영됩니다',
          });
          setSavedSignature(draft);
          router.refresh();
        } else {
          toast.error(describeError(result.error, result.detail));
        }
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
          변경 취소
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
              ? '시그니처 등록'
              : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="시그니처 배너 관리"
        subtitle="메인 §2.2 sand 단독 chapter · 운영자 HTML + 이미지 3종 · iframe sandbox 임베드 · 단일 row (영구 1개)"
        className="mb-6"
      />

      <div className="flex flex-col gap-3 min-w-0">
        {/* 기본 정보 카드 */}
        <Card title="기본 정보" subtitle="활성 · 노출 정렬">
          <div className="flex flex-col gap-3">
            <div className="flex gap-6 items-start flex-wrap">
              <FormField label="활성">
                <label className="flex gap-2 items-center h-[34px] cursor-pointer">
                  <Checkbox
                    checked={draft.enabled}
                    onCheckedChange={(v) => updateDraft('enabled', v === true)}
                  />
                  <span className="text-sm">
                    {draft.enabled ? '활성 (B2C 노출)' : '비활성 (저장만)'}
                  </span>
                </label>
              </FormField>
              <FormField label="정렬 순서" hint="향후 복수 row 대비 (현재 단일 row)">
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
                  kind: 'signature',
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

        {/* aspect-ratio 카드 · read-only */}
        <Card
          title="iframe 컨테이너 비율"
          subtitle="이미지를 등록하면 자동으로 측정·입력됩니다. 표시 전용이라 직접 수정할 수 없어요."
        >
          <div className="grid grid-cols-3 gap-3">
            <AspectInput label="Desktop (≥1024px)" value={draft.aspect_desktop} />
            <AspectInput label="Tablet (768~1023px)" value={draft.aspect_tablet} />
            <AspectInput label="Mobile (<768px)" value={draft.aspect_mobile} />
          </div>
        </Card>

        {/* 검색·접근성 메타 카드 — iframe 외부 sr-only 출력 + alt */}
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
                placeholder="예: 2026 SS 시그니처 — 산뜻한 오후 패키지 디자인 소개"
              />
            </FormField>
            <FormField label="헤드라인 (검색용 h2)">
              <FormInput
                value={draft.headline_text}
                maxLength={80}
                onChange={(e) => updateDraft('headline_text', e.target.value)}
                placeholder="예: 한 잔의 평온함"
              />
            </FormField>
            <FormField label="부제 (검색용 p)">
              <FormInput
                value={draft.subhead_text}
                maxLength={200}
                onChange={(e) => updateDraft('subhead_text', e.target.value)}
                placeholder="예: 겨울에 어울리는 단일 원두 4종"
              />
            </FormField>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField label="CTA 라벨">
                <FormInput
                  value={draft.cta_text}
                  maxLength={30}
                  onChange={(e) => updateDraft('cta_text', e.target.value)}
                  placeholder="예: 둘러보기"
                />
              </FormField>
              <FormField label="CTA 링크">
                <FormInput
                  value={draft.cta_href}
                  maxLength={500}
                  onChange={(e) => updateDraft('cta_href', e.target.value)}
                  placeholder="예: /shop · 비워두면 텍스트만 노출"
                />
              </FormField>
            </div>
          </div>
        </Card>

        {/* 기간 카드 — signature 무입력 = 영구 active */}
        <Card title="기간" subtitle="ISO 날짜 (YYYY-MM-DD) · 빈 값 = 영구 활성">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="시작일" hint="비워두면 영구 활성">
              <FormInput
                type="date"
                value={draft.start_date}
                onChange={(e) => updateDraft('start_date', e.target.value)}
              />
            </FormField>
            <FormField label="종료일" hint="비워두면 영구 활성">
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
      </div>
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

/* ── Aspect Display (read-only) ─────────────────────────────────────────── */

function AspectInput({ label, value }: { label: string; value: string }) {
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
          <h3 className="m-0 text-sm font-medium">시그니처 chapter 미리보기</h3>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5">
            발행 전 4 brk 검증 · 편집 중 즉시 반영
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
          title={`시그니처 chapter 미리보기 — ${previewBrk}`}
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

function shallowEqualSignature(a: DraftSignature, b: DraftSignature): boolean {
  return (
    a.id === b.id &&
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

/** DraftSignature → /preview/signature URL. URLSearchParams 가 자동 encode. */
function buildPreviewSrc(draft: DraftSignature): string {
  const params = new URLSearchParams({
    enabled: String(draft.enabled),
    custom_html_path: draft.custom_html_path,
    image_path_desktop: draft.image_path_desktop,
    image_path_tablet: draft.image_path_tablet,
    image_path_mobile: draft.image_path_mobile,
    image_blur_desktop: draft.image_blur_desktop,
    image_blur_tablet: draft.image_blur_tablet,
    image_blur_mobile: draft.image_blur_mobile,
    aspect_desktop: draft.aspect_desktop,
    aspect_tablet: draft.aspect_tablet,
    aspect_mobile: draft.aspect_mobile,
    image_alt: draft.image_alt,
    headline_text: draft.headline_text,
    subhead_text: draft.subhead_text,
    cta_text: draft.cta_text,
    cta_href: draft.cta_href,
  });
  return `/preview/signature?${params.toString()}`;
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

/** "2008/783" → "2008px x 783px" · 빈 값 → "—" · 형식 오류 → 원본 그대로. */
function formatAspectDisplay(value: string): string {
  if (!value) return '—';
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!m) return value;
  return `${m[1]}px x ${m[2]}px`;
}

/* ── 공용 컴포넌트 (CafeEventsForm 답습) ─────────────────────────── */

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
