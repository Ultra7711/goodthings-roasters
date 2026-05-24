import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/bannersServer.ts — banners B2C 서버 fetch (S269 Y1)

   역할:
   - getActiveBanner(kind) — 현재 활성 1 row (kind 별 우선순위)
   - getComingBanner(kind) — 7일 내 시작 예정 (cafe_event 주로 의미)
   - bannerCacheTag(kind) — kind 별 cache tag (admin actions revalidateTag 용)

   admin variant 는 별도 분리 가능 (현재 별도 admin fetch 불필요 — server action
   이 직접 admin client 로 query).

   설계:
   - server-only 격리.
   - anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag(`banners:${kind}`) — kind 별 분리로 cross-kind revalidate 차단.
   - 호출 실패 시 null/[] 반환 (메인 사이트 graceful 표시).

   참조:
   - 071_banners_unified.sql · 072_banners_data_migration.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseBannerRow,
  selectActiveBanner,
  selectComingBanner,
  type Banner,
  type BannerKind,
} from './banners';

/**
 * kind 별 cache tag. 어드민 actions 가 revalidateTag 호출 시 동일 키 사용.
 * 예: bannerCacheTag('cafe_event') → 'banners:cafe_event'
 *     bannerCacheTag('signature')  → 'banners:signature'
 */
export function bannerCacheTag(kind: BannerKind): string {
  return `banners:${kind}`;
}

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[bannersServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

const SELECT_COLS =
  'id, kind, enabled, internal_label, ' +
  'custom_html_path, image_path_desktop, image_path_tablet, image_path_mobile, ' +
  'image_blur_desktop, image_blur_tablet, image_blur_mobile, ' +
  'aspect_desktop, aspect_tablet, aspect_mobile, ' +
  'image_alt, headline_text, subhead_text, cta_text, cta_href, ' +
  'start_date, end_date, sort_order';

/* Next.js 16 dev 환경의 Supabase fetch AbortError 가 RSC streaming timing
   이슈로 간헐 발생 → 최대 2회 retry. production 영향 없음. */
async function fetchEnabledByKind(kind: BannerKind): Promise<Banner[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = getAnonClient();
    const { data, error } = await client
      .from('banners')
      .select(SELECT_COLS)
      .eq('kind', kind)
      .eq('enabled', true);

    if (error) {
      const msg = error.message ?? '';
      const aborted = /abort/i.test(msg);
      if (aborted && attempt < 2) continue;
      // eslint-disable-next-line no-console
      console.error('[bannersServer] query failed', {
        code: error.code,
        message: msg.slice(0, 200),
        details: error.details,
        hint: error.hint,
        attempt,
        kind,
      });
      return [];
    }
    if (!data) return [];

    const parsed: Banner[] = [];
    for (const row of data) {
      const b = parseBannerRow(row);
      if (b) parsed.push(b);
    }
    return parsed;
  }
  return [];
}

/**
 * 메인 페이지 chapter 가 fetch.
 * cafe_event 는 자문 §5.3 우선순위 + 기간 / signature 는 단일 row + 기간 (보통 영구).
 */
export async function getActiveBanner(kind: BannerKind): Promise<Banner | null> {
  'use cache';
  cacheTag(bannerCacheTag(kind));

  const banners = await fetchEnabledByKind(kind);
  return selectActiveBanner(banners, kind);
}

/**
 * 자문 §5.3 — active 0 + 7일 내 시작 예정 banner 있으면 Coming 표시.
 * 호출부는 active=null 인 경우에만 추가 호출 (주로 cafe_event 용).
 */
export async function getComingBanner(kind: BannerKind): Promise<Banner | null> {
  'use cache';
  cacheTag(bannerCacheTag(kind));

  const banners = await fetchEnabledByKind(kind);
  return selectComingBanner(banners, kind);
}
