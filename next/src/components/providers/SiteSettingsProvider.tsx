'use client';

/* ══════════════════════════════════════════════════════════════════════════
   SiteSettingsProvider — site_settings client context (S129 H-5)

   책임:
   - root layout 에서 mount + fetch 결과 props 로 받음.
   - 클라이언트 트리 어디서든 useSiteSettings() 로 접근.
   - 서버에서 받은 initial 을 단순 보관 (revalidate 후 재마운트로 갱신).

   사용처:
   - useCart hook (shipping.free_threshold · base_fee · enabled)
   - 마이페이지 / 카트 / 체크아웃 안내 문구
   - AnnouncementBar 는 server component 라 직접 props 전달 (context 사용 안 함)

   참조:
   - lib/siteSettings.ts (SiteSettings · DEFAULTS)
   - lib/siteSettingsServer.ts (fetchSiteSettings)
   ══════════════════════════════════════════════════════════════════════════ */

import { createContext, useContext } from 'react';
import {
  SITE_SETTINGS_DEFAULTS,
  type SiteSettings,
} from '@/lib/siteSettings';

const SiteSettingsContext = createContext<SiteSettings>(SITE_SETTINGS_DEFAULTS);

interface ProviderProps {
  initial: SiteSettings;
  children: React.ReactNode;
}

export function SiteSettingsProvider({ initial, children }: ProviderProps) {
  return (
    <SiteSettingsContext.Provider value={initial}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}
