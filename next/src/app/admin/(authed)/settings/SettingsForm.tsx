'use client';

/* ══════════════════════════════════════════
   SettingsForm — /admin/settings 클라이언트 폼 (S129 H-2 · S237 시그니처 iframe 모델)

   책임:
   - useState<SiteSettings> 단일 + initial ref → dirty 추적
   - "저장되지 않은 변경 N개" 동적 카운트 (countDirtyAreas)
   - [변경 취소] → reset to initial
   - [변경사항 저장] → saveSiteSettingsAction (변경된 영역만 payload)
   - dirty 없으면 두 버튼 비활성

   S237 (062 마이그) 시그니처 iframe 모델:
   - 운영자가 .html 1 + 이미지 3 (desktop/tablet/mobile) 업로드 → placeholder
     ({{IMAGE_DESKTOP}} 등) 치환 후 <iframe sandbox srcDoc> 임베드.
   - cafe-events (060/061) 답습 — ImageUploadSlot / AspectInput / measureImageAspect.
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Switch } from '@/components/admin/ui/switch';
import { cn } from '@/lib/utils';
import {
  composeNoticeText,
  NOTICE_COLOR_THEMES,
  type NoticeSettings,
  type ShippingSettings,
  type SignatureSettings,
  type SiteSettings,
} from '@/lib/siteSettings';
import {
  uploadSignatureImage,
  type SignatureBreakpoint,
} from '@/lib/admin/uploadSignatureImage';
import { uploadSignatureHtml } from '@/lib/admin/uploadSignatureHtml';
import { buildBannerAiPrompt } from '@/lib/admin/aiPrompt';
import {
  saveSiteSettingsAction,
  type SaveSettingsInput,
} from './actions';

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string }
  | { status: 'error'; message: string };

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

interface SettingsFormProps {
  initialSettings: SiteSettings;
  /** S232: owner (관리자) 만 저장 가능. staff (운영자) 는 모든 저장 버튼 disabled. */
  isOwner: boolean;
}

export default function SettingsForm({ initialSettings, isOwner }: SettingsFormProps) {
  const router = useRouter();
  const [savedSettings, setSavedSettings] = useState<SiteSettings>(initialSettings);
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
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
    buildPreviewSrc(initialSettings.signature),
  );
  const [previewHeight, setPreviewHeight] = useState<number>(720);

  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const tabletInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  /* settings.signature 변경 시 300ms debounce 후 iframe src 갱신 — 매 키 입력마다 reload 방지 */
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewSrc(buildPreviewSrc(settings.signature));
    }, 300);
    return () => clearTimeout(timer);
  }, [settings.signature]);

  /* iframe 으로부터 chapter height 수신 → iframe height 동기 (Phase H postMessage) */
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

  /* router.refresh 로 server component 가 fresh fetch 한 새 initialSettings 가
     내려오면 baseline 동기화. 사용자가 편집 중인 settings 는 건드리지 않음. */
  useEffect(() => {
    setSavedSettings(initialSettings);
  }, [initialSettings]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    if (!shallowEqualNotice(savedSettings.notice, settings.notice)) n += 1;
    if (!shallowEqualShipping(savedSettings.shipping, settings.shipping)) n += 1;
    if (!shallowEqualSignature(savedSettings.signature, settings.signature)) n += 1;
    return n;
  }, [savedSettings, settings]);
  const isDirty = dirtyCount > 0;

  function updateNotice(patch: Partial<NoticeSettings>) {
    setSettings((prev) => ({ ...prev, notice: { ...prev.notice, ...patch } }));
  }
  function updateShipping(patch: Partial<ShippingSettings>) {
    setSettings((prev) => ({ ...prev, shipping: { ...prev.shipping, ...patch } }));
  }
  function updateSignature(patch: Partial<SignatureSettings>) {
    setSettings((prev) => ({ ...prev, signature: { ...prev.signature, ...patch } }));
  }

  function handleReset() {
    setSettings(savedSettings);
  }

  async function handleSigImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    brk: SignatureBreakpoint,
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
    const fieldKey: keyof SignatureSettings =
      brk === 'desktop'
        ? 'image_path_desktop'
        : brk === 'tablet'
          ? 'image_path_tablet'
          : 'image_path_mobile';
    const blurKey: keyof SignatureSettings =
      brk === 'desktop'
        ? 'image_blur_desktop'
        : brk === 'tablet'
          ? 'image_blur_tablet'
          : 'image_blur_mobile';
    const aspectKey: keyof SignatureSettings =
      brk === 'desktop'
        ? 'aspect_desktop'
        : brk === 'tablet'
          ? 'aspect_tablet'
          : 'aspect_mobile';

    setState({ status: 'uploading', fileName: file.name });
    /* 이미지 dimension 측정 — aspect 자동 입력. 실패 시 기본값 유지. */
    const aspect = await measureImageAspect(file).catch(() => null);
    const result = await uploadSignatureImage(file, brk);
    if (result.ok) {
      updateSignature({
        [fieldKey]: result.publicUrl,
        /* S246: LQIP — 업로드 핸들러가 server action 으로 생성. 실패 시 빈 문자열
           (운영자 HTML 측 fallback). */
        [blurKey]: result.blurDataURL ?? '',
        ...(aspect ? { [aspectKey]: aspect } : {}),
      });
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

  async function handleSigHtmlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadSignatureHtml(file);
    if (result.ok) {
      updateSignature({ custom_html_path: result.publicUrl });
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
  async function handleSigHtmlTextUpload() {
    const text = htmlText.trim();
    if (!text) {
      toast.error('HTML 텍스트를 붙여넣어 주세요');
      return;
    }
    const blob = new Blob([text], { type: 'text/html' });
    const file = new File([blob], 'banner.html', { type: 'text/html' });

    setHtmlUpload({ status: 'uploading', fileName: file.name });
    const result = await uploadSignatureHtml(file);
    if (result.ok) {
      updateSignature({ custom_html_path: result.publicUrl });
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
    const payload: SaveSettingsInput = {};
    if (!shallowEqualNotice(savedSettings.notice, settings.notice)) {
      payload.notice = settings.notice;
    }
    if (!shallowEqualShipping(savedSettings.shipping, settings.shipping)) {
      payload.shipping = settings.shipping;
    }
    if (!shallowEqualSignature(savedSettings.signature, settings.signature)) {
      payload.signature = settings.signature;
    }

    startTransition(async () => {
      const result = await saveSiteSettingsAction(payload);
      if (result.ok) {
        setSavedSettings(settings);
        toast.success('설정을 저장했습니다', {
          description: `사이트에 즉시 반영됩니다 · ${describeUpdatedKeys(result.updatedKeys)}`,
        });
        /* router.refresh() 제거 — fresh initialSettings props 가 사용자가 막 저장한
           settings 와 미세 차이 (Zod transform / cache stale) 발생 시 useEffect 의
           setSavedSettings(initialSettings) 가 dirty 를 잔존시킴. admin 만 변경하는
           single-tenant 영역이라 self-call 후 외부 fresh fetch 불필요. 다음 페이지
           진입 시 자연스럽게 최신값 fetch. */
      } else {
        toast.error(describeError(result.error, result.detail));
      }
    });
  }

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
          변경 취소
        </Button>
        <Button
          type="button"
          size="sm"
          className="!h-7"
          disabled={!isOwner || !isDirty || isPending}
          onClick={handleSave}
          title={!isOwner ? '관리자 권한 필요' : undefined}
        >
          {isPending ? '저장 중…' : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      <AdminPageHeader
        title="메인 사이트 설정"
        subtitle={
          <>
            B2C 사이트(<span className="gtr-mono">goodthingsroasters.com</span>)에 즉시 반영돼요. 변경사항은 자동저장되지 않아요.
          </>
        }
        rightSlot={
          isDirty ? (
            <Badge tone="warning">저장되지 않은 변경 {dirtyCount}개</Badge>
          ) : (
            <Badge tone="success">최신 상태</Badge>
          )
        }
        className="mb-6"
      />

      <div className="flex flex-col gap-4">
        {/* Section 1 — 무료 배송 정책 */}
        <SettingsCard
          title="무료 배송 정책"
          subtitle="장바구니 임계 금액 이상에서 자동 적용 · 공지 배너 자동 모드의 기준 금액"
          on={settings.shipping.enabled}
          onToggle={() => updateShipping({ enabled: !settings.shipping.enabled })}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="기준 금액" hint="이 금액 이상 결제 시 무료">
                <FormInput
                  suffix="원 이상"
                  inputMode="numeric"
                  value={formatNumber(settings.shipping.free_threshold)}
                  onChange={(e) =>
                    updateShipping({ free_threshold: parseNumber(e.target.value) })
                  }
                />
              </FormField>
              <FormField label="기본 배송비" hint="장바구니 · 상품 상세 · 법적 고지(배송/반품 정책)에 자동 반영">
                <FormInput
                  suffix="원"
                  inputMode="numeric"
                  value={formatNumber(settings.shipping.base_fee)}
                  onChange={(e) =>
                    updateShipping({ base_fee: parseNumber(e.target.value) })
                  }
                />
              </FormField>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--info-soft)] border border-[var(--info-border)] flex gap-3 items-start text-xs text-[var(--info)]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-[1px]"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <div>
                <div className="font-medium text-[#1F4F8B]">참고</div>
                <div className="mt-0.5 text-[var(--info)]">
                  변경 시 메인 사이트 장바구니 · 결제하기 · 마이페이지 모두 즉시 반영됩니다. (페이지 새로고침 후)
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* Section 2 — 공지 배너 */}
        <SettingsCard
          title="공지 배너"
          subtitle="페이지 최상단에 노출되는 1줄 띠 배너"
          on={settings.notice.enabled}
          onToggle={() => updateNotice({ enabled: !settings.notice.enabled })}
        >
          <div className="flex flex-col gap-4">
            {/* 라이브 미리보기 */}
            <div
              className="rounded-[6px] overflow-hidden border border-border"
              style={{ opacity: settings.notice.enabled ? 1 : 0.4 }}
            >
              <div className="text-[10px] font-mono px-2.5 py-1 bg-[var(--surface-muted)] text-[var(--foreground-subtle)] border-b border-border">
                미리보기 · goodthingsroasters.com
              </div>
              <div
                className="px-4 py-2.5 text-sm text-center tracking-[-0.005em]"
                style={{
                  background: NOTICE_COLOR_THEMES[settings.notice.theme_idx][0],
                  color: NOTICE_COLOR_THEMES[settings.notice.theme_idx][1],
                }}
              >
                {(() => {
                  const previewText = composeNoticeText(settings.notice, settings.shipping);
                  const previewSecondary = settings.notice.secondary;
                  if (!previewText && !previewSecondary) {
                    return (
                      <span className="opacity-50 italic">
                        (빈 공지 — 메인 사이트에 표시되지 않음)
                      </span>
                    );
                  }
                  return (
                    <>
                      {previewText}
                      {previewSecondary && (
                        <>
                          {previewText && ' · '}
                          <span className="opacity-[0.85]">{previewSecondary}</span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <label className="flex gap-2 items-center cursor-pointer">
              <Checkbox
                checked={settings.notice.auto_text}
                onCheckedChange={(v) => updateNotice({ auto_text: v === true })}
              />
              <span className="text-xs font-medium">
                무료배송 임계값 자동 표시{' '}
                <span className="text-muted-foreground font-normal">(권장)</span>
              </span>
            </label>

            <div className="grid grid-cols-[1fr_200px] gap-3">
              <FormField
                label="배너 문구"
                hint={
                  settings.notice.auto_text
                    ? '자동 모드 ON — "무료 배송 정책" 카드의 기준 금액으로 합성됩니다'
                    : '비워두면 보조 문구만 표시 · 이모지 1개와 링크 1개 권장'
                }
              >
                <FormInput
                  value={
                    settings.notice.auto_text
                      ? composeNoticeText(settings.notice, settings.shipping)
                      : settings.notice.text
                  }
                  onChange={(e) => updateNotice({ text: e.target.value })}
                  disabled={settings.notice.auto_text}
                  placeholder="예: 5월의 새 원두 입고 — 첫 주문 10% 할인"
                />
              </FormField>
              <FormField label="링크">
                <FormInput
                  value={settings.notice.link}
                  onChange={(e) => updateNotice({ link: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="보조 문구 (영문)" hint="비워두면 표시 안 함">
              <FormInput
                value={settings.notice.secondary}
                onChange={(e) => updateNotice({ secondary: e.target.value })}
              />
            </FormField>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">색상 테마</span>
              <div className="flex gap-1.5">
                {NOTICE_COLOR_THEMES.map(([bg, fg], i) => {
                  const sel = i === settings.notice.theme_idx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateNotice({ theme_idx: i })}
                      aria-label={`색상 테마 ${i + 1}`}
                      aria-pressed={sel}
                      className="size-7 rounded-[5px] flex items-center justify-center text-[10px] font-semibold cursor-pointer p-0"
                      style={{
                        background: bg,
                        color: fg,
                        border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                      }}
                    >
                      Aa
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* Section 3 — 시그니처 섹션 (S237 iframe 모델 · 062) */}
        <SettingsCard
          title="시그니처 섹션"
          subtitle="메인 페이지 §2.2 sand 단독 chapter · 운영자 HTML + 이미지 3종 · iframe sandbox 임베드"
          on={settings.signature.enabled}
          onToggle={() => updateSignature({ enabled: !settings.signature.enabled })}
        >
          <div className="flex flex-col gap-4">
            {/* 이미지 3종 */}
            <SubCard
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
                      kind: 'signature',
                      aspectDesktop: settings.signature.aspect_desktop,
                      aspectTablet: settings.signature.aspect_tablet,
                      aspectMobile: settings.signature.aspect_mobile,
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
                  imagePath={settings.signature.image_path_desktop}
                  uploadState={desktopUpload}
                  inputRef={desktopInputRef}
                  onUpload={(e) => handleSigImageUpload(e, 'desktop')}
                  onClear={() => updateSignature({ image_path_desktop: '', image_blur_desktop: '' })}
                />
                <ImageUploadSlot
                  label="Tablet"
                  sublabel="{{IMAGE_TABLET}}"
                  imagePath={settings.signature.image_path_tablet}
                  uploadState={tabletUpload}
                  inputRef={tabletInputRef}
                  onUpload={(e) => handleSigImageUpload(e, 'tablet')}
                  onClear={() => updateSignature({ image_path_tablet: '', image_blur_tablet: '' })}
                />
                <ImageUploadSlot
                  label="Mobile"
                  sublabel="{{IMAGE_MOBILE}}"
                  imagePath={settings.signature.image_path_mobile}
                  uploadState={mobileUpload}
                  inputRef={mobileInputRef}
                  onUpload={(e) => handleSigImageUpload(e, 'mobile')}
                  onClear={() => updateSignature({ image_path_mobile: '', image_blur_mobile: '' })}
                />
              </div>
            </SubCard>

            {/* HTML 파일 */}
            <SubCard
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
                    onChange={handleSigHtmlUpload}
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
                    {settings.signature.custom_html_path
                      ? `등록됨 · ${summarizeUrl(settings.signature.custom_html_path)}`
                      : '선택된 파일 없음 · 5MB 이하 · .html'}
                  </span>
                  {settings.signature.custom_html_path && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-7 !text-xs !text-[var(--danger)] hover:!bg-[var(--danger-soft)] ml-auto"
                      onClick={() => updateSignature({ custom_html_path: '' })}
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
                {settings.signature.custom_html_path && (
                  <a
                    href={settings.signature.custom_html_path}
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
                        onClick={handleSigHtmlTextUpload}
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
            </SubCard>

            {/* aspect-ratio · S239 read-only 표시 */}
            <SubCard
              title="iframe 컨테이너 비율"
              subtitle="이미지를 등록하면 자동으로 측정·입력됩니다. 표시 전용이라 직접 수정할 수 없어요."
            >
              <div className="grid grid-cols-3 gap-3">
                <AspectInput
                  label="Desktop (≥1024px)"
                  value={settings.signature.aspect_desktop}
                />
                <AspectInput
                  label="Tablet (768~1023px)"
                  value={settings.signature.aspect_tablet}
                />
                <AspectInput
                  label="Mobile (<768px)"
                  value={settings.signature.aspect_mobile}
                />
              </div>
            </SubCard>

            {/* 검색·접근성 메타 — iframe 외부 sr-only 출력 + alt (063) */}
            <SubCard
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
                    value={settings.signature.image_alt}
                    maxLength={120}
                    onChange={(e) => updateSignature({ image_alt: e.target.value })}
                    placeholder="예: 2026 SS 시그니처 — 산뜻한 오후 패키지 디자인 소개"
                  />
                </FormField>
                <FormField label="헤드라인 (검색용 h2)">
                  <FormInput
                    value={settings.signature.headline_text}
                    maxLength={80}
                    onChange={(e) => updateSignature({ headline_text: e.target.value })}
                    placeholder="예: 한 잔의 평온함"
                  />
                </FormField>
                <FormField label="부제 (검색용 p)">
                  <FormInput
                    value={settings.signature.subhead_text}
                    maxLength={200}
                    onChange={(e) => updateSignature({ subhead_text: e.target.value })}
                    placeholder="예: 겨울에 어울리는 단일 원두 4종"
                  />
                </FormField>
                <div className="grid grid-cols-[1fr_2fr] gap-3">
                  <FormField label="CTA 라벨">
                    <FormInput
                      value={settings.signature.cta_text}
                      maxLength={30}
                      onChange={(e) => updateSignature({ cta_text: e.target.value })}
                      placeholder="예: 둘러보기"
                    />
                  </FormField>
                  <FormField label="CTA 링크">
                    <FormInput
                      value={settings.signature.cta_href}
                      maxLength={500}
                      onChange={(e) => updateSignature({ cta_href: e.target.value })}
                      placeholder="예: /shop · 비워두면 텍스트만 노출"
                    />
                  </FormField>
                </div>
              </div>
            </SubCard>
          </div>
        </SettingsCard>

        {/* Preview — advisory §6.1 D-1 4 brk 발행 전 미리보기 */}
        <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h3 className="m-0 text-base font-medium">
                시그니처 chapter 미리보기
              </h3>
              <div className="text-xs text-muted-foreground mt-0.5">
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
                    onClick={() => setPreviewBrk(opt.key)}
                    aria-pressed={sel}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer whitespace-nowrap',
                      sel
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                        : 'bg-[var(--surface)] text-foreground border-border',
                    )}
                  >
                    {opt.label}{' '}
                    <span className="opacity-70 ml-1 font-mono text-[10px]">
                      {opt.width}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isDirty && (
            <div className="px-6 py-2 bg-[var(--warning-soft)] text-[var(--warning)] text-xs border-b border-border">
              저장되지 않은 변경 {dirtyCount}개 — 미리보기는 즉시 반영 · 저장 시 라이브 사이트 반영
            </div>
          )}

          <div className="p-4 bg-[var(--surface-muted)] overflow-x-auto overflow-y-hidden flex justify-start">
            <iframe
              src={previewSrc}
              title={`시그니처 섹션 미리보기 — ${previewBrk}`}
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

/* ── Helpers ─────────────────────────────────────────────────── */

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}
function parseNumber(s: string): number {
  const cleaned = s.replace(/[^\d]/g, '');
  if (cleaned === '') return 0;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function summarizeUrl(url: string): string {
  const parts = url.split('/');
  const name = parts[parts.length - 1] ?? url;
  return name.length > 36 ? `${name.slice(0, 32)}…` : name;
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

function shallowEqualNotice(a: NoticeSettings, b: NoticeSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.auto_text === b.auto_text &&
    a.text === b.text &&
    a.secondary === b.secondary &&
    a.link === b.link &&
    a.theme_idx === b.theme_idx
  );
}
function shallowEqualShipping(a: ShippingSettings, b: ShippingSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.free_threshold === b.free_threshold &&
    a.base_fee === b.base_fee
  );
}
function shallowEqualSignature(a: SignatureSettings, b: SignatureSettings): boolean {
  return (
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
    a.cta_href === b.cta_href
  );
}

function describeUpdatedKeys(keys: ReadonlyArray<string>): string {
  const labels: Record<string, string> = {
    notice: '공지 배너',
    shipping: '무료 배송 정책',
    signature: '시그니처 섹션',
  };
  return keys.map((k) => labels[k] ?? k).join(' · ');
}

/** SignatureSettings → /preview/signature URL. */
function buildPreviewSrc(s: SignatureSettings): string {
  const params = new URLSearchParams({
    enabled: String(s.enabled),
    custom_html_path: s.custom_html_path,
    image_path_desktop: s.image_path_desktop,
    image_path_tablet: s.image_path_tablet,
    image_path_mobile: s.image_path_mobile,
    aspect_desktop: s.aspect_desktop,
    aspect_tablet: s.aspect_tablet,
    aspect_mobile: s.aspect_mobile,
    image_alt: s.image_alt,
    headline_text: s.headline_text,
    subhead_text: s.subhead_text,
    cta_text: s.cta_text,
    cta_href: s.cta_href,
  });
  return `/preview/signature?${params.toString()}`;
}

function describeUploadError(error: string, detail?: string): string {
  switch (error) {
    case 'too_large':
      return `파일이 너무 큽니다 — ${detail ?? '5MB 이하로 다시 시도해 주세요'}`;
    case 'unsupported_type':
      return `지원하지 않는 파일 형식이에요 — ${detail ?? 'webp/avif/jpeg/png · .html 만 지원합니다'}`;
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
    case 'no_changes':
      return '변경된 항목이 없습니다.';
    case 'server_error':
    default:
      return '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

/* ── 공용 컴포넌트 ─────────────────────────────────── */

function SettingsCard({
  title,
  subtitle,
  on,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)]">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3">
        <div className="flex-1">
          <h3 className="m-0 text-sm font-medium">{title}</h3>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <Switch
            checked={on}
            onCheckedChange={() => onToggle()}
            aria-label={on ? `${title} — 비활성으로 전환` : `${title} — 활성으로 전환`}
            className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
          />
          <span className="text-muted-foreground">
            {on ? '활성' : '비활성'}
          </span>
        </label>
      </div>
      <div
        className="p-6 transition-opacity duration-150"
        style={{ opacity: on ? 1 : 0.5 }}
      >
        {children}
      </div>
    </div>
  );
}

function SubCard({
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
    <div className="bg-[var(--surface)] border border-border rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-sm font-medium">{title}</h4>
          <div className="text-xs text-[var(--foreground-muted)] mt-0.5 leading-relaxed">{subtitle}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'warning' | 'success';
  children: React.ReactNode;
}) {
  const isWarn = tone === 'warning';
  return (
    <span
      className="inline-flex items-center gap-[5px] px-2 py-0.5 rounded-full text-xs font-medium tracking-[-0.005em] leading-[1.5] whitespace-nowrap"
      style={{
        background: isWarn ? 'var(--warning-soft)' : 'var(--success-soft)',
        color: isWarn ? 'var(--warning)' : 'var(--success)',
      }}
    >
      <span
        aria-hidden
        className="size-[5px] rounded-full"
        style={{ background: isWarn ? 'var(--warning)' : 'var(--success)' }}
      />
      {children}
    </span>
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
        <div className="text-xs text-muted-foreground pl-2.5">{hint}</div>
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
      className="flex items-center gap-2 px-2.5 h-[34px] border border-[var(--input)] rounded-[6px] shadow-xs transition-[color,box-shadow] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
      style={{
        background: disabled ? 'var(--surface-muted)' : 'var(--surface)',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {prefix && (
        <span className="text-muted-foreground text-sm">{prefix}</span>
      )}
      <input
        {...rest}
        className="flex-1 min-w-0 border-0 outline-none shadow-none ring-0 bg-transparent text-sm text-[var(--foreground)] p-0 h-full"
      />
      {suffix && (
        <span className="text-muted-foreground text-xs">{suffix}</span>
      )}
    </div>
  );
}
