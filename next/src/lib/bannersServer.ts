import 'server-only';
import { isPrerenderAbort } from './prerenderAbort';

/* ══════════════════════════════════════════════════════════════════════════
   lib/bannersServer.ts — banners B2C 서버 fetch (S269 Y1)

   역할:
   - getActiveBanner(kind) — 현재 활성 1 row (kind 별 우선순위)
   - getComingBanner(kind) — 7일 내 시작 예정 (cafe_event 주로 의미)
   - bannerCacheTag(kind) — kind 별 cache tag (admin actions revalidateTag 용)

   admin variant 는 별도 분리 가능 (현재 별도 admin fetch 불필요 — server action
   이 직접 admin client 로 query).

   설계 (S280-B · DEC-S279-D-1 정합 — ADR-010):
   - server-only 격리.
   - anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' 미사용 — row 수 작아 부담 미미 + 운영자 변경 즉시 반영 보장
     (Next.js 16 revalidateTag/updateTag 가 dev 환경 invalidate 회귀 발견 후 폐기).
   - cachedClient singleton 패턴 폐기 — dev HMR closure 회귀 차단 (S278 학습 #4).
   - global.fetch override 로 cache: 'no-store' 강제.
   - connection() 책임 = caller (SSR 페이지 server component) 측 명시 호출.
     본 helper 는 connection() 호출 X — 3-domain (productsServer/cafeMenuServer/
     gooddaysServer) 답습 패턴과 통일 (S280-B · ADR-008).
     caller: CafeMenuSection.tsx / SignatureChapter.tsx (둘 다 helper 호출 전
     `await connection()` 명시 — 이미 정합).
   - bannerCacheTag(kind) 함수는 export 보존 (향후 캐싱 재도입 시 활용).
   - 호출 실패 시 null/[] 반환 (메인 사이트 graceful 표시).

   참조:
   - 071_banners_unified.sql · 072_banners_data_migration.sql
   - ADR-010 (caller-side connection responsibility · S280-B)
   ══════════════════════════════════════════════════════════════════════════ */

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

/* singleton 패턴 폐기 — dev HMR 후 옛 client 가 closure 로 잡혀 fetch override
   적용 안 되는 회귀 발견. 매 호출 새 createClient (Supabase JS 인스턴스 비용 미미). */
function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      '[bannersServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
    );
  }
  /* Next.js 16 cacheComponents:true 환경에서 GET 요청 fetch 가 default
     cache 될 수 있어 운영자 변경 후 메인 stale. Supabase REST 요청 = GET 형태
     → 명시적 cache: 'no-store' 강제로 매 호출 fresh fetch 보장. */
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...(init as RequestInit), cache: 'no-store' }),
    },
  });
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

      if (!isPrerenderAbort(msg)) {
        console.error('[bannersServer] query failed', {
          code: error.code,
          message: msg.slice(0, 200),
          details: error.details,
          hint: error.hint,
          attempt,
          kind,
        });
      }
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
 *
 * 'use cache' 미사용: row 수 (kind 별 1~10) 가 작아 매 요청 DB fetch 부담 미미 +
 * 운영자가 admin 변경 직후 즉시 반영 보장 (revalidateTag/updateTag invalidate
 * 가 dev 환경에서 inconsistent 한 회귀 회피).
 *
 * connection() 책임 = caller (CafeMenuSection / SignatureChapter) 측. Next.js 16
 * cacheComponents 룰 — selectActiveBanner 가 `new Date()` 로 today 계산하므로
 * caller 페이지 dynamic API 선행 호출 없으면 prerender 시점의 fixed time 으로 cache
 * 되어 영원히 stale (DEC-S278-1). S280-B 부 helper connection() 제거 — ADR-010.
 */
export async function getActiveBanner(kind: BannerKind): Promise<Banner | null> {
  const banners = await fetchEnabledByKind(kind);
  return selectActiveBanner(banners, kind);
}

/**
 * 자문 §5.3 — active 0 + 7일 내 시작 예정 banner 있으면 Coming 표시.
 * 호출부는 active=null 인 경우에만 추가 호출 (주로 cafe_event 용).
 * connection() 책임 = caller. S280-B 부 helper connection() 제거 — ADR-010.
 */
export async function getComingBanner(kind: BannerKind): Promise<Banner | null> {
  const banners = await fetchEnabledByKind(kind);
  return selectComingBanner(banners, kind);
}
