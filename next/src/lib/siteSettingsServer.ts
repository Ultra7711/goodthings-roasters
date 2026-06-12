import 'server-only';
import { isPrerenderAbort } from './prerenderAbort';

/* ══════════════════════════════════════════════════════════════════════════
   lib/siteSettingsServer.ts — site_settings 서버 fetch (S129 Group H)

   역할:
   - DB rows → SiteSettings 객체 (Zod parse via parseSiteSettingsRows).
   - server-only 격리 — 클라이언트 번들에 anon key 모듈 직결 방지.

   설계:
   - cookies() 무관 anon 클라이언트 사용 (site_settings RLS 가 public SELECT 허용).
   - cookies 미사용으로 Next.js cacheComponents 의 dynamic boundary 트리거 회피.
   - 호출 실패 시 SITE_SETTINGS_DEFAULTS 로 graceful fallback (메인 사이트 표시 깨지지 않게).

   사용처:
   - app/admin/(authed)/settings/page.tsx (편집 초기값)
   - app/layout.tsx 또는 영역별 server component (메인 사이트 SSR fetch — H-5)
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseSiteSettingsRows,
  SITE_SETTINGS_DEFAULTS,
  type SiteSettings,
} from './siteSettings';

/** revalidateTag 로 무효화할 때 사용. settings/actions.ts 와 일치. */
export const SITE_SETTINGS_CACHE_TAG = 'site-settings';

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[siteSettingsServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

/**
 * site_settings 전체 영역 fetch.
 * 실패 시 SITE_SETTINGS_DEFAULTS 반환 (메인 사이트가 hardcoded 였던 값과 동일).
 */
export async function fetchSiteSettings(): Promise<SiteSettings> {
  'use cache';
  cacheTag(SITE_SETTINGS_CACHE_TAG);

  const client = getAnonClient();
  const { data, error } = await client
    .from('site_settings')
    .select('key, value');

  if (error) {
    if (!isPrerenderAbort(error.message)) {
      console.error('[fetchSiteSettings] query failed', {
        code: error.code,
        message: error.message?.slice(0, 200),
      });
    }
    return SITE_SETTINGS_DEFAULTS;
  }
  if (!data) return SITE_SETTINGS_DEFAULTS;

  return parseSiteSettingsRows(data as ReadonlyArray<{ key: string; value: unknown }>);
}
