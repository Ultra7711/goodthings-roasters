'use client';

/* ══════════════════════════════════════════
   SettingsForm — /admin/settings 클라이언트 폼 (S129 H-2 · S256-A 분리 · S270 Phase 3b)

   Orchestrator 책임:
   - useState<SiteSettings> 단일 (saved + current) → dirty 추적
   - "저장되지 않은 변경 N개" 동적 카운트
   - [변경 취소] → reset to saved
   - [변경사항 저장] → saveSiteSettingsAction (변경된 영역만 payload)
   - dirty 없으면 두 버튼 비활성
   - 3 SubForm 호출 (Shipping / Notice / HomeFeatured)

   S270 Phase 3b — signature 분리:
   - signature 는 banners 통합 테이블로 이전 → /admin/signatures 페이지에서 편집.
   - SettingsForm 에선 signature 카드 + Preview iframe 제거.
   ══════════════════════════════════════════ */

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import type { CafeMenuItem } from '@/lib/cafeMenu';
import type {
  HomeFeaturedSettings,
  HoursSettings,
  NoticeSettings,
  PointsSettings,
  ShippingSettings,
  SiteSettings,
} from '@/lib/siteSettings';
import {
  saveSiteSettingsAction,
  type SaveSettingsInput,
} from './actions';
import { ShippingSubForm } from './sections/ShippingSubForm';
import { NoticeSubForm } from './sections/NoticeSubForm';
import { HomeFeaturedSubForm } from './sections/HomeFeaturedSubForm';
import { HoursSubForm } from './sections/HoursSubForm';
import { PointsSubForm } from './sections/PointsSubForm';
import { Badge } from './_shared/Badge';
import { describeError } from '@/lib/admin/errorDescribe';
import {
  describeUpdatedKeys,
  equalHours,
  equalPoints,
  shallowEqualHomeFeatured,
  shallowEqualNotice,
  shallowEqualShipping,
} from './_shared/helpers';

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

  /* router.refresh 로 server component 가 fresh fetch 한 새 initialSettings 가
     내려오면 baseline 동기화. 사용자가 편집 중인 settings 는 건드리지 않음. */
  useEffect(() => {
    setSavedSettings(initialSettings);
  }, [initialSettings]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    if (!shallowEqualNotice(savedSettings.notice, settings.notice)) n += 1;
    if (!shallowEqualShipping(savedSettings.shipping, settings.shipping)) n += 1;
    if (!shallowEqualHomeFeatured(savedSettings.home_featured, settings.home_featured)) n += 1;
    if (!equalHours(savedSettings.hours, settings.hours)) n += 1;
    if (!equalPoints(savedSettings.points, settings.points)) n += 1;
    return n;
  }, [savedSettings, settings]);
  const isDirty = dirtyCount > 0;

  function updateNotice(patch: Partial<NoticeSettings>) {
    setSettings((prev) => ({ ...prev, notice: { ...prev.notice, ...patch } }));
  }
  function updateShipping(patch: Partial<ShippingSettings>) {
    setSettings((prev) => ({ ...prev, shipping: { ...prev.shipping, ...patch } }));
  }
  function updateHomeFeatured(patch: Partial<HomeFeaturedSettings>) {
    setSettings((prev) => ({ ...prev, home_featured: { ...prev.home_featured, ...patch } }));
  }
  function updateHours(patch: Partial<HoursSettings>) {
    setSettings((prev) => ({ ...prev, hours: { ...prev.hours, ...patch } }));
  }
  function updatePoints(patch: Partial<PointsSettings>) {
    setSettings((prev) => ({ ...prev, points: { ...prev.points, ...patch } }));
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
    if (!shallowEqualHomeFeatured(savedSettings.home_featured, settings.home_featured)) {
      payload.home_featured = settings.home_featured;
    }
    if (!equalHours(savedSettings.hours, settings.hours)) {
      /* 빈 날짜 비정기 휴무 행은 저장에서 제외 (입력 중 빈 행 방어) */
      payload.hours = {
        ...settings.hours,
        closures: settings.hours.closures.filter((c) => c.date),
      };
    }
    if (!equalPoints(savedSettings.points, settings.points)) {
      payload.points = settings.points;
    }

    startTransition(async () => {
      const result = await saveSiteSettingsAction(payload);
      if (result.ok) {
        /* S255-A HIGH-4: server 가 upsert 후 fresh SELECT 한 savedSettings 로
           saved + current 동시 동기화. Zod transform / cache stale 미세 차이로
           인한 dirty 잔존 차단. fresh fetch 자체가 실패한 경우 (undefined) 는
           client 측 settings 로 fallback. */
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

        {/* Section 3 — 메인 노출 카페 메뉴 (S248 · 069) */}
        <HomeFeaturedSubForm
          value={settings.home_featured}
          onChange={updateHomeFeatured}
          cafeMenus={cafeMenus}
        />

        {/* Section 4 — 매장 영업시간 (Story Location 위젯 반영) */}
        <HoursSubForm value={settings.hours} onChange={updateHours} />

        {/* Section 5 — 적립금(포인트) 정책 (S327 · Phase 4) */}
        <PointsSubForm value={settings.points} onChange={updatePoints} />
      </div>
    </>
  );
}
