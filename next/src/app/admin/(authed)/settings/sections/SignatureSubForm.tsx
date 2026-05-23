/* ══════════════════════════════════════════
   sections/SignatureSubForm.tsx — Section 3: 시그니처 섹션 (S256-A 분리)

   - S237 iframe HTML 모델 (062): 운영자 HTML 1 + 이미지 3 (desktop/tablet/mobile)
     placeholder 치환 후 <iframe sandbox srcDoc> 임베드.
   - cafe-events (060/061) 답습 — ImageUploadSlot / AspectInput / measureImageAspect.

   State ownership (ADR-009 §10 DEC-18):
   - 4 upload state + 4 refs + htmlTextOpen/Text 모두 SignatureSubForm 내부 owner.
   - settings.signature 자체는 orchestrator 가 보유 (props.value).
   - Preview iframe 관련 state (previewBrk/Src/Height) 와 postMessage listener 는
     orchestrator 보유 (D3 — Preview 위치 유지).
   ══════════════════════════════════════════ */

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/admin/ui/button';
import { buildBannerAiPrompt } from '@/lib/admin/aiPrompt';
import {
  uploadSignatureImage,
  type SignatureBreakpoint,
} from '@/lib/admin/uploadSignatureImage';
import { uploadSignatureHtml } from '@/lib/admin/uploadSignatureHtml';
import type { SignatureSettings } from '@/lib/siteSettings';
import { SettingsCard } from '../_shared/SettingsCard';
import { SubCard } from '../_shared/SubCard';
import { FormField } from '../_shared/FormField';
import { FormInput } from '../_shared/FormInput';
import {
  describeUploadError,
  formatAspectDisplay,
  measureImageAspect,
  summarizeUrl,
} from '../_shared/helpers';
import type { UploadState } from '../_shared/types';

interface SignatureSubFormProps {
  value: SignatureSettings;
  onChange: (patch: Partial<SignatureSettings>) => void;
}

export function SignatureSubForm({ value, onChange }: SignatureSubFormProps) {
  const [htmlUpload, setHtmlUpload] = useState<UploadState>({ status: 'idle' });
  const [desktopUpload, setDesktopUpload] = useState<UploadState>({ status: 'idle' });
  const [tabletUpload, setTabletUpload] = useState<UploadState>({ status: 'idle' });
  const [mobileUpload, setMobileUpload] = useState<UploadState>({ status: 'idle' });

  /* HTML 텍스트 직접 입력 (AI 결과 코드 블록 붙여넣기용) */
  const [htmlTextOpen, setHtmlTextOpen] = useState(false);
  const [htmlText, setHtmlText] = useState('');

  const htmlInputRef = useRef<HTMLInputElement | null>(null);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const tabletInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

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
      onChange({
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
      onChange({ custom_html_path: result.publicUrl });
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
      onChange({ custom_html_path: result.publicUrl });
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

  return (
    <SettingsCard
      title="시그니처 섹션"
      subtitle="메인 페이지 §2.2 sand 단독 chapter · 운영자 HTML + 이미지 3종 · iframe sandbox 임베드"
      on={value.enabled}
      onToggle={() => onChange({ enabled: !value.enabled })}
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
                  aspectDesktop: value.aspect_desktop,
                  aspectTablet: value.aspect_tablet,
                  aspectMobile: value.aspect_mobile,
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
              imagePath={value.image_path_desktop}
              uploadState={desktopUpload}
              inputRef={desktopInputRef}
              onUpload={(e) => handleSigImageUpload(e, 'desktop')}
              onClear={() => onChange({ image_path_desktop: '', image_blur_desktop: '' })}
            />
            <ImageUploadSlot
              label="Tablet"
              sublabel="{{IMAGE_TABLET}}"
              imagePath={value.image_path_tablet}
              uploadState={tabletUpload}
              inputRef={tabletInputRef}
              onUpload={(e) => handleSigImageUpload(e, 'tablet')}
              onClear={() => onChange({ image_path_tablet: '', image_blur_tablet: '' })}
            />
            <ImageUploadSlot
              label="Mobile"
              sublabel="{{IMAGE_MOBILE}}"
              imagePath={value.image_path_mobile}
              uploadState={mobileUpload}
              inputRef={mobileInputRef}
              onUpload={(e) => handleSigImageUpload(e, 'mobile')}
              onClear={() => onChange({ image_path_mobile: '', image_blur_mobile: '' })}
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
                {value.custom_html_path
                  ? `등록됨 · ${summarizeUrl(value.custom_html_path)}`
                  : '선택된 파일 없음 · 5MB 이하 · .html'}
              </span>
              {value.custom_html_path && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!h-7 !text-xs !text-[var(--danger)] hover:!bg-[var(--danger-soft)] ml-auto"
                  onClick={() => onChange({ custom_html_path: '' })}
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
            {value.custom_html_path && (
              <a
                href={value.custom_html_path}
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
              value={value.aspect_desktop}
            />
            <AspectInput
              label="Tablet (768~1023px)"
              value={value.aspect_tablet}
            />
            <AspectInput
              label="Mobile (<768px)"
              value={value.aspect_mobile}
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
                value={value.image_alt}
                maxLength={120}
                onChange={(e) => onChange({ image_alt: e.target.value })}
                placeholder="예: 2026 SS 시그니처 — 산뜻한 오후 패키지 디자인 소개"
              />
            </FormField>
            <FormField label="헤드라인 (검색용 h2)">
              <FormInput
                value={value.headline_text}
                maxLength={80}
                onChange={(e) => onChange({ headline_text: e.target.value })}
                placeholder="예: 한 잔의 평온함"
              />
            </FormField>
            <FormField label="부제 (검색용 p)">
              <FormInput
                value={value.subhead_text}
                maxLength={200}
                onChange={(e) => onChange({ subhead_text: e.target.value })}
                placeholder="예: 겨울에 어울리는 단일 원두 4종"
              />
            </FormField>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <FormField label="CTA 라벨">
                <FormInput
                  value={value.cta_text}
                  maxLength={30}
                  onChange={(e) => onChange({ cta_text: e.target.value })}
                  placeholder="예: 둘러보기"
                />
              </FormField>
              <FormField label="CTA 링크">
                <FormInput
                  value={value.cta_href}
                  maxLength={500}
                  onChange={(e) => onChange({ cta_href: e.target.value })}
                  placeholder="예: /shop · 비워두면 텍스트만 노출"
                />
              </FormField>
            </div>
          </div>
        </SubCard>
      </div>
    </SettingsCard>
  );
}

/* ── Image Upload Slot ────────────────────────────────────────── */

interface ImageUploadSlotProps {
  label: string;
  sublabel: string;
  required?: boolean;
  imagePath: string;
  uploadState: UploadState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

function ImageUploadSlot({
  label,
  sublabel,
  required,
  imagePath,
  uploadState,
  inputRef,
  onUpload,
  onClear,
}: ImageUploadSlotProps) {
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

/* ── Aspect Display (read-only · S239) ────────────────────────
   이미지 업로드 시 naturalWidth/Height 가 자동 측정되어 값이 채워짐.
   운영자가 직접 수정하면 iframe 컨테이너 비율 ↔ 실 이미지 비율 불일치로
   화면이 stretch/squash 될 위험. 따라서 표시 전용으로 전환. 비율 정보 자체는
   AI prompt 에 들어가므로 운영자가 확인할 수 있어야 함. */

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
