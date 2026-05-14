'use client';

/* ══════════════════════════════════════════
   SettingsForm — /admin/settings 클라이언트 폼 (S129 H-2 변형 1)

   책임:
   - useState<SiteSettings> 단일 + initial ref → dirty 추적
   - "저장되지 않은 변경 N개" 동적 카운트 (countDirtyAreas)
   - [변경 취소] → reset to initial
   - [변경사항 저장] → saveSiteSettingsAction (변경된 영역만 payload)
   - dirty 없으면 두 버튼 비활성
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { Checkbox } from '@/components/admin/ui/checkbox';
import { Switch } from '@/components/admin/ui/switch';
import { cn } from '@/lib/utils';
import {
  composeNoticeText,
  NOTICE_COLOR_THEMES,
  type NoticeSettings,
  type SeasonSettings,
  type ShippingSettings,
  type SignatureSettings,
  type SiteSettings,
} from '@/lib/siteSettings';
import { uploadSeasonBanner } from '@/lib/admin/uploadSeasonBanner';
import { uploadSignatureImage } from '@/lib/admin/uploadSignatureImage';
import { FlavorChipInput } from '@/components/admin/FlavorChipInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/admin/ui/select';
import type { Product } from '@/lib/products';

/** Radix Select 는 SelectItem value="" 비허용 — 빈 슬러그 sentinel. */
const PRODUCT_NONE_VALUE = '__none__';
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
  coffeeBeans: Product[];
}

export default function SettingsForm({ initialSettings, coffeeBeans }: SettingsFormProps) {
  const router = useRouter();
  const [savedSettings, setSavedSettings] = useState<SiteSettings>(initialSettings);
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const [sigUploadState, setSigUploadState] = useState<UploadState>({ status: 'idle' });
  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() =>
    buildPreviewSrc(initialSettings.signature),
  );
  const [previewHeight, setPreviewHeight] = useState<number>(720);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!shallowEqualSeason(savedSettings.season, settings.season)) n += 1;
    if (!shallowEqualShipping(savedSettings.shipping, settings.shipping)) n += 1;
    if (!shallowEqualSignature(savedSettings.signature, settings.signature)) n += 1;
    return n;
  }, [savedSettings, settings]);
  const isDirty = dirtyCount > 0;

  function updateNotice(patch: Partial<NoticeSettings>) {
    setSettings((prev) => ({ ...prev, notice: { ...prev.notice, ...patch } }));
  }
  function updateSeason(patch: Partial<SeasonSettings>) {
    setSettings((prev) => ({ ...prev, season: { ...prev.season, ...patch } }));
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    /* input value reset — 같은 파일 재선택 가능하게 */
    e.target.value = '';
    if (!file) return;

    setUploadState({ status: 'uploading', fileName: file.name });
    const result = await uploadSeasonBanner(file);
    if (result.ok) {
      updateSeason({ image_path: result.publicUrl });
      setUploadState({ status: 'idle' });
      toast.success('이미지가 업로드되었습니다 · 변경사항 저장 후 반영됩니다');
    } else {
      const message = describeUploadError(result.error, result.detail);
      setUploadState({ status: 'error', message });
      toast.error(message);
    }
  }

  async function handleSigFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSigUploadState({ status: 'uploading', fileName: file.name });
    const result = await uploadSignatureImage(file);
    if (result.ok) {
      updateSignature({ image_path: result.publicUrl });
      setSigUploadState({ status: 'idle' });
      toast.success('이미지가 업로드되었습니다 · 변경사항 저장 후 반영됩니다');
    } else {
      const message = describeUploadError(result.error, result.detail);
      setSigUploadState({ status: 'error', message });
      toast.error(message);
    }
  }

  function handleSave() {
    const payload: SaveSettingsInput = {};
    if (!shallowEqualNotice(savedSettings.notice, settings.notice)) {
      payload.notice = settings.notice;
    }
    if (!shallowEqualSeason(savedSettings.season, settings.season)) {
      payload.season = settings.season;
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
        toast.success('설정이 저장되었습니다 · B2C 사이트에 즉시 반영', {
          description: describeUpdatedKeys(result.updatedKeys),
        });
        router.refresh();
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
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? '저장 중…' : '변경사항 저장'}
        </Button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h2 className="m-0 text-2xl font-medium tracking-[-0.02em]">
            메인 사이트 설정
          </h2>
          <div className="mt-1 text-sm text-muted-foreground">
            B2C 사이트(<span className="gtr-mono">goodthingsroasters.com</span>)에 즉시 반영돼요. 변경사항은 자동저장되지 않아요.
          </div>
        </div>
        {isDirty ? (
          <Badge tone="warning">저장되지 않은 변경 {dirtyCount}개</Badge>
        ) : (
          <Badge tone="success">최신 상태</Badge>
        )}
      </div>

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
                  변경 시 메인 사이트 장바구니·결제하기·마이페이지 모두 즉시 반영됩니다. (페이지 새로고침 후)
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

        {/* Section 3 — 시즌 배너 */}
        <SettingsCard
          title="시즌 배너"
          subtitle="홈 히어로 영역의 큰 배너"
          on={settings.season.enabled}
          onToggle={() => updateSeason({ enabled: !settings.season.enabled })}
        >
          <div className="grid grid-cols-[1fr_240px] gap-4 items-start">
            <div className="flex flex-col gap-4">
              <FormField label="Eyebrow (작은 라벨)">
                <FormInput
                  value={settings.season.eyebrow}
                  onChange={(e) => updateSeason({ eyebrow: e.target.value })}
                />
              </FormField>
              <FormField label="제목">
                <FormInput
                  value={settings.season.title}
                  onChange={(e) => updateSeason({ title: e.target.value })}
                />
              </FormField>
              <FormField label="부제 / 설명">
                <textarea
                  value={settings.season.subtitle}
                  onChange={(e) => updateSeason({ subtitle: e.target.value })}
                  className="w-full min-h-16 resize-y px-3 py-2.5 border border-[var(--input)] rounded-[6px] text-sm leading-[1.6] text-[var(--foreground)] outline-none bg-[var(--surface)] shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  style={{ fontFamily: 'inherit' }}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="CTA 텍스트">
                  <FormInput
                    value={settings.season.cta_text}
                    onChange={(e) => updateSeason({ cta_text: e.target.value })}
                  />
                </FormField>
                <FormField label="CTA 링크">
                  <FormInput
                    value={settings.season.cta_link}
                    onChange={(e) => updateSeason({ cta_link: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="시작일" hint="비워두면 상시 노출">
                  <FormInput
                    type="date"
                    value={settings.season.start_date}
                    onChange={(e) => updateSeason({ start_date: e.target.value })}
                  />
                </FormField>
                <FormField label="종료일" hint="비워두면 상시 노출">
                  <FormInput
                    type="date"
                    value={settings.season.end_date}
                    onChange={(e) => updateSeason({ end_date: e.target.value })}
                  />
                </FormField>
              </div>
            </div>

            <div>
              <FormField label="히어로 이미지">
                {settings.season.image_path ? (
                  <div
                    className="rounded-[6px] overflow-hidden border border-border aspect-[4/5] bg-cover bg-center relative flex items-end p-2.5"
                    style={{ backgroundImage: `url("${settings.season.image_path}")` }}
                  >
                    <span className="font-mono text-[10px] px-[7px] py-[3px] rounded-[4px] bg-white/90 text-muted-foreground max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {summarizeImagePath(settings.season.image_path)}
                    </span>
                  </div>
                ) : (
                  <div
                    className="rounded-[6px] overflow-hidden border border-border aspect-[4/5] flex items-center justify-center text-muted-foreground text-xs"
                    style={{
                      background: 'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 6px, var(--placeholder-pattern-2) 6px 12px)',
                    }}
                  >
                    이미지 없음
                  </div>
                )}
              </FormField>
              <FormField label="대체 텍스트 (alt)">
                <FormInput
                  value={settings.season.image_alt}
                  onChange={(e) => updateSeason({ image_alt: e.target.value })}
                />
              </FormField>
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

              {uploadState.status === 'uploading' && (
                <div className="mt-2">
                  <div className="h-1 rounded-sm bg-[var(--surface-muted)] overflow-hidden relative">
                    <div className="gtr-admin-progress-indet" />
                  </div>
                  <div
                    className="mt-2 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                    title={uploadState.fileName}
                  >
                    {uploadState.fileName}
                  </div>
                </div>
              )}

              {uploadState.status === 'error' && (
                <div className="mt-2 px-2.5 py-2 rounded-[6px] bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
                  {uploadState.message}
                </div>
              )}
            </div>
          </div>
        </SettingsCard>

        {/* Section 4 — 시그니처 섹션 (S148 PR-2 advisory §6) */}
        <SettingsCard
          title="시그니처 섹션"
          subtitle="메인 페이지 §2.2 sand 단독 chapter · 분기 갱신 (SS/SU/FW/WT)"
          on={settings.signature.enabled}
          onToggle={() =>
            updateSignature({ enabled: !settings.signature.enabled })
          }
        >
          <div className="grid grid-cols-[1fr_240px] gap-4 items-start">
            <div className="flex flex-col gap-4">
              {/* eyebrow + 분기 자동 채움 */}
              <FormField
                label="Eyebrow (분기 라벨)"
                hint="형식: Signature · 2026 SS · 분기 pill 클릭 시 자동 채움"
              >
                <FormInput
                  value={settings.signature.eyebrow}
                  onChange={(e) => updateSignature({ eyebrow: e.target.value })}
                  placeholder="예: Signature · 2026 SS"
                />
                <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground mr-0.5">빠른 채움</span>
                  {QUARTER_LABELS.map((q) => {
                    const { year } = getCurrentQuarter();
                    const composed = composeEyebrow(q, year);
                    const sel = settings.signature.eyebrow === composed;
                    return (
                      <button
                        key={q}
                        type="button"
                        data-slot="chip-radio"
                        onClick={() => updateSignature({ eyebrow: composed })}
                        aria-pressed={sel}
                        className={cn(
                          'px-3 py-1.5 rounded-md text-xs border font-medium cursor-pointer',
                          sel
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]'
                            : 'bg-[var(--surface)] text-foreground border-border',
                        )}
                      >
                        {q} · {year}
                      </button>
                    );
                  })}
                </div>
              </FormField>

              {/* product 드롭다운 — Coffee Bean 만 (advisory §6.1 SKU 1개 매핑) */}
              <FormField
                label="제품 (Coffee Bean)"
                hint="시그니처에 호명할 원두 1종 — 빈 값 시 chapter 자동 hide"
              >
                <Select
                  value={settings.signature.product_slug || PRODUCT_NONE_VALUE}
                  onValueChange={(v) =>
                    updateSignature({
                      product_slug: v === PRODUCT_NONE_VALUE ? '' : v,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— 선택 —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRODUCT_NONE_VALUE}>— 선택 —</SelectItem>
                    {coffeeBeans.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        {p.name} ({p.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="제목 (한국어 제품명)" hint="최대 40자">
                <FormInput
                  value={settings.signature.title}
                  onChange={(e) => updateSignature({ title: e.target.value })}
                  maxLength={40}
                  placeholder="예: 산뜻한 오후"
                />
              </FormField>

              <FormField
                label="본문 카피 (1~2줄)"
                hint={`권장 80자 이내 · 명사형 짧게 · 현재 ${settings.signature.subtitle.length}/160자`}
              >
                <textarea
                  value={settings.signature.subtitle}
                  onChange={(e) => updateSignature({ subtitle: e.target.value })}
                  maxLength={160}
                  className="w-full min-h-16 resize-y px-3 py-2.5 border border-[var(--input)] rounded-[6px] text-sm leading-[1.6] text-[var(--foreground)] outline-none bg-[var(--surface)] shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  style={{ fontFamily: 'inherit' }}
                />
              </FormField>

              <FormField
                label="플레이버 chip"
                hint="최대 4개 · 권장 3개 · 영문은 공백으로 구분 (예: 복숭아 Peach)"
              >
                <FlavorChipInput
                  value={settings.signature.flavor_chips}
                  onChange={(chips) => updateSignature({ flavor_chips: chips })}
                  max={4}
                  emptyMessage="(chip 없음 — 자동 가져오기 또는 수동 추가)"
                  showCount
                  extraAction={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="!h-7 whitespace-nowrap"
                      onClick={() => {
                        const notes = extractTastingNotes(settings.signature.product_slug, coffeeBeans);
                        if (notes.length === 0) {
                          toast.info('제품을 먼저 선택해 주세요');
                          return;
                        }
                        updateSignature({ flavor_chips: notes });
                        toast.success(`Tasting Notes ${notes.length}개를 가져왔습니다`);
                      }}
                    >
                      Tasting Notes 가져오기
                    </Button>
                  }
                />
              </FormField>
            </div>

            {/* 우측 — 이미지 5:4 + 안전 영역 가이드 (advisory §3.3 inset 12% 18%) */}
            <div>
              <FormField
                label="이미지 (5:4 패키지 정면)"
                hint="안전 영역 (점선) 안쪽에 패키지 라벨 배치"
              >
                {settings.signature.image_path ? (
                  <div
                    className="rounded-[6px] overflow-hidden border border-border aspect-[5/4] bg-cover bg-center relative"
                    style={{ backgroundImage: `url("${settings.signature.image_path}")` }}
                  >
                    {/* 안전 영역 가이드 (advisory §3.3) — 좌우 18%, 상하 12% */}
                    <div
                      aria-hidden
                      className="absolute border border-dashed border-[rgba(28,27,25,0.6)] bg-[rgba(28,27,25,0.04)] pointer-events-none"
                      style={{ inset: '12% 18%' }}
                    />
                    <span className="absolute bottom-1.5 left-1.5 font-mono text-[10px] px-[7px] py-[3px] rounded-[4px] bg-white/90 text-muted-foreground max-w-[calc(100%-12px)] overflow-hidden text-ellipsis whitespace-nowrap">
                      {summarizeImagePath(settings.signature.image_path)}
                    </span>
                  </div>
                ) : (
                  <div
                    className="rounded-[6px] overflow-hidden border border-border aspect-[5/4] flex items-center justify-center text-muted-foreground text-xs relative"
                    style={{
                      background: 'repeating-linear-gradient(135deg, var(--placeholder-pattern-1) 0 6px, var(--placeholder-pattern-2) 6px 12px)',
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute border border-dashed border-[rgba(28,27,25,0.4)] pointer-events-none"
                      style={{ inset: '12% 18%' }}
                    />
                    이미지 없음
                  </div>
                )}
              </FormField>
              <FormField label="대체 텍스트 (alt)">
                <FormInput
                  value={settings.signature.image_alt}
                  onChange={(e) => updateSignature({ image_alt: e.target.value })}
                  maxLength={120}
                />
              </FormField>
              <input
                ref={sigFileInputRef}
                type="file"
                accept="image/webp,image/avif,image/jpeg,image/png"
                onChange={handleSigFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="!h-7 w-full mt-2"
                onClick={() => sigFileInputRef.current?.click()}
                disabled={sigUploadState.status === 'uploading'}
              >
                {sigUploadState.status === 'uploading' ? '업로드 중…' : '이미지 변경'}
              </Button>

              {sigUploadState.status === 'uploading' && (
                <div className="mt-2">
                  <div className="h-1 rounded-sm bg-[var(--surface-muted)] overflow-hidden relative">
                    <div className="gtr-admin-progress-indet" />
                  </div>
                  <div
                    className="mt-2 text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap"
                    title={sigUploadState.fileName}
                  >
                    {sigUploadState.fileName}
                  </div>
                </div>
              )}

              {sigUploadState.status === 'error' && (
                <div className="mt-2 px-2.5 py-2 rounded-[6px] bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)] text-xs">
                  {sigUploadState.message}
                </div>
              )}
            </div>
          </div>
        </SettingsCard>

        {/* Preview — advisory §6.1 D-1 4 brk 발행 전 미리보기 */}
        <div className="bg-[var(--surface)] border border-border rounded-[var(--radius)] overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h3 className="m-0 text-base font-medium">
                메인 페이지 미리보기
              </h3>
              <div className="text-xs text-muted-foreground mt-0.5">
                시그니처 chapter 발행 전 4 brk 검증 · 저장된 설정 기준
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

function summarizeImagePath(p: string): string {
  if (p.startsWith('http')) {
    /* Storage public URL — 파일명만 추출 */
    const u = p.split('/').pop() ?? p;
    return u.length > 32 ? `${u.slice(0, 28)}…` : u;
  }
  return p.length > 32 ? `${p.slice(0, 28)}…` : p;
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
function shallowEqualSeason(a: SeasonSettings, b: SeasonSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.eyebrow === b.eyebrow &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.cta_text === b.cta_text &&
    a.cta_link === b.cta_link &&
    a.start_date === b.start_date &&
    a.end_date === b.end_date &&
    a.image_path === b.image_path &&
    a.image_alt === b.image_alt
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
  if (a.flavor_chips.length !== b.flavor_chips.length) return false;
  for (let i = 0; i < a.flavor_chips.length; i += 1) {
    if (a.flavor_chips[i].ko !== b.flavor_chips[i].ko) return false;
    if (a.flavor_chips[i].en !== b.flavor_chips[i].en) return false;
  }
  return (
    a.enabled === b.enabled &&
    a.eyebrow === b.eyebrow &&
    a.product_slug === b.product_slug &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
    a.image_path === b.image_path &&
    a.image_alt === b.image_alt
  );
}

function describeUpdatedKeys(keys: ReadonlyArray<string>): string {
  const labels: Record<string, string> = {
    notice: '공지 배너',
    season: '시즌 배너',
    shipping: '무료 배송 정책',
    signature: '시그니처 섹션',
  };
  return keys.map((k) => labels[k] ?? k).join(' · ');
}

/* ── 시그니처 분기 라벨 (advisory §6.1 자동 채움) ─────────────────────────
   분기 매핑: 3~5월 SS · 6~8월 SU · 9~11월 FW · 12~2월 WT.
   advisory §6.3 발행 D-day 와 일치 (3/1 SS · 6/15 SU · 9/1 FW · 12/1 WT). */
const QUARTER_LABELS = ['SS', 'SU', 'FW', 'WT'] as const;
type QuarterLabel = (typeof QUARTER_LABELS)[number];

function getCurrentQuarter(date: Date = new Date()): { season: QuarterLabel; year: number } {
  const m = date.getMonth() + 1; // 1-12
  if (m >= 3 && m <= 5) return { season: 'SS', year: date.getFullYear() };
  if (m >= 6 && m <= 8) return { season: 'SU', year: date.getFullYear() };
  if (m >= 9 && m <= 11) return { season: 'FW', year: date.getFullYear() };
  // 12~2월 WT — 1·2월은 직전 해 WT 시즌
  return { season: 'WT', year: m === 12 ? date.getFullYear() : date.getFullYear() - 1 };
}

function composeEyebrow(season: QuarterLabel, year: number): string {
  return `Signature · ${year} ${season}`;
}

/** SignatureSettings → /preview/signature URL.
    chips: 'ko:en|ko:en' 형식 — ':' 로 ko/en 분리, '|' 로 chip 분리. */
function buildPreviewSrc(s: SignatureSettings): string {
  const params = new URLSearchParams({
    enabled: String(s.enabled),
    eyebrow: s.eyebrow,
    product_slug: s.product_slug,
    title: s.title,
    subtitle: s.subtitle,
    chips: s.flavor_chips.map((c) => `${c.ko}:${c.en}`).join('|'),
    image_path: s.image_path,
    image_alt: s.image_alt,
  });
  return `/preview/signature?${params.toString()}`;
}

/** coffeeBeans 의 noteTags + noteTagsEn → {ko, en}[] 최대 3개 (advisory §5.1). */
function extractTastingNotes(slug: string, beansList: Product[]): Array<{ ko: string; en: string }> {
  const product = beansList.find((p) => p.slug === slug);
  if (!product) return [];
  const kos = product.noteTags.split(' | ').map((s) => s.trim()).filter(Boolean);
  const ens = product.noteTagsEn.split(' | ').map((s) => s.trim());
  return kos.slice(0, 3).map((ko, i) => ({ ko, en: ens[i] ?? '' }));
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
        <Switch
          checked={on}
          onCheckedChange={() => onToggle()}
          className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
        />
        <div className="flex-1">
          <h3 className="m-0 text-sm font-medium">{title}</h3>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
        <span className="text-xs text-muted-foreground">
          {on ? '활성' : '비활성'}
        </span>
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
  hint?: string;
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
