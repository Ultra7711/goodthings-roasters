'use client';

/* ══════════════════════════════════════════
   SettingsForm — /admin/settings 클라이언트 폼 (S129 H-2 · S256-A 분리)

   Orchestrator 책임:
   - useState<SiteSettings> 단일 (saved + current) → dirty 추적
   - "저장되지 않은 변경 N개" 동적 카운트
   - [변경 취소] → reset to saved
   - [변경사항 저장] → saveSiteSettingsAction (변경된 영역만 payload)
   - dirty 없으면 두 버튼 비활성
   - 4 SubForm 호출 (Shipping / Notice / Signature / HomeFeatured) + Signature Preview iframe

   섹션별 자체 state 는 각 SubForm 내부 owner (ADR-009 §10 DEC-18):
   - SignatureSubForm: 4 upload state + 4 refs + htmlText/Open + 3 upload handlers
   - 나머지 3 SubForm: 자체 state 없음 (props only)
   - Preview iframe state (brk/src/height) + signature debounce + postMessage listener
     는 orchestrator 보유 (Preview 위치 유지 D3).

   S237 (062 마이그) 시그니처 iframe 모델:
   - 운영자가 .html 1 + 이미지 3 (desktop/tablet/mobile) 업로드 → placeholder
     ({{IMAGE_DESKTOP}} 등) 치환 후 <iframe sandbox srcDoc> 임베드.
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { cn } from '@/lib/utils';
import type { CafeMenuItem } from '@/lib/cafeMenu';
import type {
  HomeFeaturedSettings,
  NoticeSettings,
  ShippingSettings,
  SignatureSettings,
  SiteSettings,
} from '@/lib/siteSettings';
import {
  saveSiteSettingsAction,
  type SaveSettingsInput,
} from './actions';
import { ShippingSubForm } from './sections/ShippingSubForm';
import { NoticeSubForm } from './sections/NoticeSubForm';
import { SignatureSubForm } from './sections/SignatureSubForm';
import { HomeFeaturedSubForm } from './sections/HomeFeaturedSubForm';
import { Badge } from './_shared/Badge';
import { describeError } from '@/lib/admin/errorDescribe';
import {
  buildPreviewSrc,
  describeUpdatedKeys,
  shallowEqualHomeFeatured,
  shallowEqualNotice,
  shallowEqualShipping,
  shallowEqualSignature,
} from './_shared/helpers';
import { PREVIEW_BRK_OPTIONS, type PreviewBrk } from './_shared/types';

interface SettingsFormProps {
  initialSettings: SiteSettings;
  /** S232: owner (관리자) 만 저장 가능. staff (운영자) 는 모든 저장 버튼 disabled. */
  isOwner: boolean;
  /** S248: 메인 노출 카페 메뉴 슬롯 dropdown 옵션 source (is_active=true · status 무관). */
  cafeMenus: CafeMenuItem[];
}

export default function SettingsForm({ initialSettings, isOwner, cafeMenus }: SettingsFormProps) {
  const [savedSettings, setSavedSettings] = useState<SiteSettings>(initialSettings);
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();

  /* Preview iframe 관련 state — orchestrator owner (ADR-009 §10 D3) */
  const [previewBrk, setPreviewBrk] = useState<PreviewBrk>('desktop');
  const [previewSrc, setPreviewSrc] = useState<string>(() =>
    buildPreviewSrc(initialSettings.signature),
  );
  const [previewHeight, setPreviewHeight] = useState<number>(720);

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
    if (!shallowEqualHomeFeatured(savedSettings.home_featured, settings.home_featured)) n += 1;
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
  function updateHomeFeatured(patch: Partial<HomeFeaturedSettings>) {
    setSettings((prev) => ({ ...prev, home_featured: { ...prev.home_featured, ...patch } }));
  }

  function handleReset() {
    setSettings(savedSettings);
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
    if (!shallowEqualHomeFeatured(savedSettings.home_featured, settings.home_featured)) {
      payload.home_featured = settings.home_featured;
    }

    startTransition(async () => {
      const result = await saveSiteSettingsAction(payload);
      if (result.ok) {
        /* S255-A HIGH-4: server 가 upsert 후 fresh SELECT 한 savedSettings 로
           saved + current 동시 동기화. Zod transform / cache stale 미세 차이로
           인한 dirty 잔존 차단. fresh fetch 자체가 실패한 경우 (undefined) 는
           client 측 settings 로 fallback. (router.refresh 미사용 — 동일 페이지
           머무는 사용자도 즉시 server-normalized 값을 받음.) */
        const next = result.savedSettings ?? settings;
        setSavedSettings(next);
        if (result.savedSettings) setSettings(next);
        toast.success('설정을 저장했습니다', {
          description: `사이트에 즉시 반영됩니다 · ${describeUpdatedKeys(result.updatedKeys)}`,
        });
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
        <ShippingSubForm value={settings.shipping} onChange={updateShipping} />

        {/* Section 2 — 공지 배너 */}
        <NoticeSubForm
          value={settings.notice}
          onChange={updateNotice}
          shipping={settings.shipping}
        />

        {/* Section 3 — 시그니처 섹션 (S237 iframe 모델 · 062) */}
        <SignatureSubForm value={settings.signature} onChange={updateSignature} />

        {/* Section 4 — 메인 노출 카페 메뉴 (S248 · 069) */}
        <HomeFeaturedSubForm
          value={settings.home_featured}
          onChange={updateHomeFeatured}
          cafeMenus={cafeMenus}
        />

        {/* Preview — advisory §6.1 D-1 4 brk 발행 전 미리보기 (Section 4 다음 위치 유지) */}
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
