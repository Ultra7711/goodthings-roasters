'use client';

/* ══════════════════════════════════════════
   SettingsForm — /admin/settings 클라이언트 폼 (S129 H-2 변형 1)

   책임:
   - 시안 settings.jsx inline style 100% 유지 (S126 이식 베이스)
   - useState<SiteSettings> 단일 + initial ref → dirty 추적
   - "저장되지 않은 변경 N개" 동적 카운트 (countDirtyAreas)
   - [변경 취소] → reset to initial
   - [변경사항 저장] → saveSiteSettingsAction (변경된 영역만 payload)
   - dirty 없으면 두 버튼 비활성

   변경 안 된 mock 컴포넌트 (시즌 배너 이미지 업로드) 는 H-3 에서 갱신.
   Toast 는 H-4 에서 추가.
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import {
  composeNoticeText,
  countDirtyAreas,
  NOTICE_COLOR_THEMES,
  type NoticeSettings,
  type SeasonSettings,
  type ShippingSettings,
  type SignatureSettings,
  type SiteSettings,
} from '@/lib/siteSettings';
import { uploadSeasonBanner } from '@/lib/admin/uploadSeasonBanner';
import { uploadSignatureImage } from '@/lib/admin/uploadSignatureImage';
import { PRODUCTS } from '@/lib/products';
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
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
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

  const dirtyCount = useMemo(
    () => countDirtyAreas(savedSettings, settings),
    [savedSettings, settings],
  );
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
        <button
          type="button"
          style={{ ...SM_GHOST, opacity: isDirty ? 1 : 0.4, cursor: isDirty ? 'pointer' : 'not-allowed' }}
          disabled={!isDirty || isPending}
          onClick={handleReset}
        >
          변경 취소
        </button>
        <button
          type="button"
          style={{ ...SM_PRIMARY, opacity: isDirty && !isPending ? 1 : 0.5, cursor: isDirty && !isPending ? 'pointer' : 'not-allowed' }}
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? '저장 중…' : '변경사항 저장'}
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
            메인 사이트 설정
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            B2C 사이트(<span className="gtr-mono">goodthingsroasters.com</span>)에 즉시 반영돼요. 변경사항은 자동저장되지 않아요.
          </div>
        </div>
        {isDirty ? (
          <Badge tone="warning">저장되지 않은 변경 {dirtyCount}개</Badge>
        ) : (
          <Badge tone="success">최신 상태</Badge>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 880 }}>
        {/* Section 1 — 공지 배너 */}
        <SettingsCard
          title="공지 배너"
          subtitle="페이지 최상단에 노출되는 1줄 띠 배너"
          on={settings.notice.enabled}
          onToggle={() => updateNotice({ enabled: !settings.notice.enabled })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 라이브 미리보기 */}
            <div
              style={{
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                opacity: settings.notice.enabled ? 1 : 0.4,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  background: 'var(--surface-muted)',
                  color: 'var(--foreground-subtle)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                미리보기 · goodthingsroasters.com
              </div>
              <div
                style={{
                  background: NOTICE_COLOR_THEMES[settings.notice.theme_idx][0],
                  color: NOTICE_COLOR_THEMES[settings.notice.theme_idx][1],
                  padding: '10px 16px',
                  fontSize: 13,
                  textAlign: 'center',
                  letterSpacing: '-0.005em',
                }}
              >
                {(() => {
                  const previewText = composeNoticeText(settings.notice, settings.shipping);
                  const previewSecondary = settings.notice.secondary;
                  if (!previewText && !previewSecondary) {
                    return (
                      <span style={{ opacity: 0.5, fontStyle: 'italic' }}>
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
                          <span style={{ opacity: 0.85 }}>{previewSecondary}</span>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* 자동 동기화 토글 */}
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 6,
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={settings.notice.auto_text}
                onChange={(e) => updateNotice({ auto_text: e.target.checked })}
                style={{ marginTop: 2, accentColor: 'var(--primary)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                  무료배송 임계값 자동 표시{' '}
                  <span style={{ color: 'var(--foreground-muted)', fontWeight: 400 }}>
                    (권장)
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
                  체크 시 아래 “무료 배송 정책” 의 기준 금액이 자동으로 반영돼요.
                  마케팅 카피로 직접 작성하려면 체크를 해제하세요.
                </div>
              </div>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
              <FormField
                label="배너 문구"
                hint={
                  settings.notice.auto_text
                    ? '자동 모드 ON — “무료 배송 정책” 카드의 기준 금액으로 합성됩니다'
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>색상 테마</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {NOTICE_COLOR_THEMES.map(([bg, fg], i) => {
                  const sel = i === settings.notice.theme_idx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateNotice({ theme_idx: i })}
                      aria-label={`색상 테마 ${i + 1}`}
                      aria-pressed={sel}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        background: bg,
                        color: fg,
                        border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
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

        {/* Section 2 — 시즌 배너 */}
        <SettingsCard
          title="시즌 배너"
          subtitle="홈 히어로 영역의 큰 배너"
          on={settings.season.enabled}
          onToggle={() => updateSeason({ enabled: !settings.season.enabled })}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                  style={{
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
                  }}
                />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                    style={{
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      aspectRatio: '4/5',
                      backgroundImage: `url("${settings.season.image_path}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: 10,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 10,
                        padding: '3px 7px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.9)',
                        color: 'var(--foreground-muted)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {summarizeImagePath(settings.season.image_path)}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      aspectRatio: '4/5',
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
                  cursor: uploadState.status === 'uploading' ? 'not-allowed' : 'pointer',
                }}
              >
                {uploadState.status === 'uploading' ? '업로드 중…' : '이미지 변경'}
              </button>

              {uploadState.status === 'uploading' && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--surface-muted)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div className="gtr-admin-progress-indet" />
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--foreground-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={uploadState.fileName}
                  >
                    {uploadState.fileName}
                  </div>
                </div>
              )}

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
        </SettingsCard>

        {/* Section 3 — 시그니처 한 잔 (S148 PR-2 advisory §6) */}
        <SettingsCard
          title="시그니처 섹션"
          subtitle="메인 페이지 §2.2 sand 단독 chapter · 분기 갱신 (SS/SU/FW/WT)"
          on={settings.signature.enabled}
          onToggle={() =>
            updateSignature({ enabled: !settings.signature.enabled })
          }
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    marginTop: 6,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--foreground-muted)',
                      marginRight: 2,
                    }}
                  >
                    빠른 채움
                  </span>
                  {QUARTER_LABELS.map((q) => {
                    const { year } = getCurrentQuarter();
                    const composed = composeEyebrow(q, year);
                    const sel = settings.signature.eyebrow === composed;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => updateSignature({ eyebrow: composed })}
                        aria-pressed={sel}
                        style={{
                          padding: '3px 9px',
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '0.04em',
                          borderRadius: 999,
                          background: sel ? 'var(--primary)' : 'var(--surface)',
                          color: sel ? '#fff' : 'var(--foreground-muted)',
                          border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--border)'),
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
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
                <select
                  value={settings.signature.product_slug}
                  onChange={(e) => updateSignature({ product_slug: e.target.value })}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    border: '1px solid var(--input)',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    color: 'var(--foreground)',
                    outline: 'none',
                    background: 'var(--surface)',
                  }}
                >
                  <option value="">— 선택 —</option>
                  {PRODUCTS.filter((p) => p.category === 'Coffee Bean').map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
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
                  style={{
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
                  }}
                />
              </FormField>

              <FormField
                label="플레이버 chip"
                hint="최대 4개 · 권장 3개 · Tasting Notes 자동 가져오기 사용 권장"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {settings.signature.flavor_chips.length === 0 ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--foreground-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        (chip 없음 — 자동 가져오기 또는 수동 추가)
                      </span>
                    ) : (
                      settings.signature.flavor_chips.map((chip, i) => (
                        <span
                          key={`${chip}-${i}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 4px 3px 10px',
                            fontSize: 12,
                            background: 'var(--surface-muted)',
                            border: '1px solid var(--border)',
                            borderRadius: 999,
                            color: 'var(--foreground)',
                          }}
                        >
                          {chip}
                          <button
                            type="button"
                            onClick={() =>
                              updateSignature({
                                flavor_chips: settings.signature.flavor_chips.filter(
                                  (_, idx) => idx !== i,
                                ),
                              })
                            }
                            aria-label={`${chip} 삭제`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--foreground-muted)',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <FormInput
                      placeholder="예: 복숭아 · 살구 · 시럽"
                      maxLength={20}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const target = e.currentTarget;
                        const value = target.value.trim();
                        if (!value) return;
                        if (settings.signature.flavor_chips.length >= 4) return;
                        if (settings.signature.flavor_chips.includes(value)) return;
                        updateSignature({
                          flavor_chips: [...settings.signature.flavor_chips, value],
                        });
                        target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const notes = extractTastingNotes(settings.signature.product_slug);
                        if (notes.length === 0) {
                          toast.info('제품을 먼저 선택해 주세요');
                          return;
                        }
                        updateSignature({ flavor_chips: notes });
                        toast.success(`Tasting Notes ${notes.length}개를 가져왔습니다`);
                      }}
                      style={{
                        ...SM_SECONDARY,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Tasting Notes 가져오기
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                    Enter 로 추가 · 현재 {settings.signature.flavor_chips.length}/4
                  </div>
                </div>
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
                    style={{
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      aspectRatio: '5/4',
                      backgroundImage: `url("${settings.signature.image_path}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                    }}
                  >
                    {/* 안전 영역 가이드 (advisory §3.3) — 좌우 18%, 상하 12% */}
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: '12% 18%',
                        border: '1px dashed rgba(28, 27, 25, 0.6)',
                        background: 'rgba(28, 27, 25, 0.04)',
                        pointerEvents: 'none',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 6,
                        left: 6,
                        fontFamily: 'monospace',
                        fontSize: 10,
                        padding: '3px 7px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.9)',
                        color: 'var(--foreground-muted)',
                        maxWidth: 'calc(100% - 12px)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {summarizeImagePath(settings.signature.image_path)}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      aspectRatio: '5/4',
                      background:
                        'repeating-linear-gradient(135deg, #EEEDEB 0 6px, #F5F4F2 6px 12px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--foreground-muted)',
                      fontSize: 11,
                      position: 'relative',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: '12% 18%',
                        border: '1px dashed rgba(28, 27, 25, 0.4)',
                        pointerEvents: 'none',
                      }}
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
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => sigFileInputRef.current?.click()}
                disabled={sigUploadState.status === 'uploading'}
                style={{
                  ...SM_SECONDARY,
                  width: '100%',
                  marginTop: 8,
                  opacity: sigUploadState.status === 'uploading' ? 0.6 : 1,
                  cursor: sigUploadState.status === 'uploading' ? 'not-allowed' : 'pointer',
                }}
              >
                {sigUploadState.status === 'uploading' ? '업로드 중…' : '이미지 변경'}
              </button>

              {sigUploadState.status === 'uploading' && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--surface-muted)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div className="gtr-admin-progress-indet" />
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--foreground-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={sigUploadState.fileName}
                  >
                    {sigUploadState.fileName}
                  </div>
                </div>
              )}

              {sigUploadState.status === 'error' && (
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
                  {sigUploadState.message}
                </div>
              )}
            </div>
          </div>
        </SettingsCard>

        {/* Preview — advisory §6.1 D-1 4 brk 발행 전 미리보기 */}
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
              padding: '16px 22px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                메인 페이지 미리보기
              </h3>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--foreground-muted)',
                  marginTop: 2,
                }}
              >
                시그니처 chapter 발행 전 4 brk 검증 · 저장된 설정 기준
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {PREVIEW_BRK_OPTIONS.map((opt) => {
                const sel = previewBrk === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPreviewBrk(opt.key)}
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
                      letterSpacing: '-0.005em',
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
                padding: '8px 22px',
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
                fontSize: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              저장되지 않은 변경 {dirtyCount}개 — 미리보기는 즉시 반영 · 저장 시 라이브 사이트 반영
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
              key={previewBrk}
              src={previewSrc}
              title={`시그니처 섹션 미리보기 — ${previewBrk}`}
              style={{
                width: PREVIEW_BRK_OPTIONS.find((o) => o.key === previewBrk)?.width ?? 1440,
                height: previewHeight,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--color-background-primary, #FBF8F3)',
                flexShrink: 0,
                transition: 'height 200ms ease-out',
              }}
            />
          </div>
        </div>

        {/* Section 4 — 무료 배송 */}
        <SettingsCard
          title="무료 배송 정책"
          subtitle="장바구니 임계 금액 이상에서 자동 적용"
          on={settings.shipping.enabled}
          onToggle={() => updateShipping({ enabled: !settings.shipping.enabled })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              <FormField label="기본 배송비">
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

            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: 'var(--info-soft)',
                border: '1px solid #C5DCF1',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 12.5,
                color: 'var(--info)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <div>
                <div style={{ fontWeight: 500, color: '#1F4F8B' }}>참고</div>
                <div style={{ marginTop: 2, color: 'var(--info)' }}>
                  변경 시 메인 사이트 카트·체크아웃·마이페이지 모두 즉시 반영됩니다 (페이지 새로고침 후).
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>
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
    if (a.flavor_chips[i] !== b.flavor_chips[i]) return false;
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

/** SignatureSettings → /preview/signature URL. URLSearchParams 가 자동 encode.
    chips 는 '|' 구분 (chip 안에 '|' 들어가지 않는다 가정). */
function buildPreviewSrc(s: SignatureSettings): string {
  const params = new URLSearchParams({
    enabled: String(s.enabled),
    eyebrow: s.eyebrow,
    product_slug: s.product_slug,
    title: s.title,
    subtitle: s.subtitle,
    chips: s.flavor_chips.join('|'),
    image_path: s.image_path,
    image_alt: s.image_alt,
  });
  return `/preview/signature?${params.toString()}`;
}

/** PRODUCTS 의 noteTags ("a | b | c | d") → chip 배열. 최대 3개 권장 (advisory §5.1). */
function extractTastingNotes(slug: string): string[] {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return [];
  return product.noteTags
    .split(' | ')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
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
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface)',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{title}</h3>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: on ? 'var(--success)' : 'var(--foreground-muted)',
          }}
        >
          {on ? '활성' : '비활성'}
        </span>
        <Toggle on={on} onClick={onToggle} />
      </div>
      <div
        style={{
          padding: 22,
          opacity: on ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: on ? 'var(--primary)' : '#D4D4D2',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: isWarn ? 'var(--warning-soft)' : 'var(--success-soft)',
        color: isWarn ? 'var(--warning)' : 'var(--success)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: isWarn ? 'var(--warning)' : 'var(--success)',
        }}
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

/* ── 시안 Button(size=sm) inline style ─────────────────────────────────── */

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

const SM_PRIMARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
