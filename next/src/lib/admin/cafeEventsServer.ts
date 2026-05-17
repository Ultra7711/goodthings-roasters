import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/cafeEventsServer.ts — /admin/cafe-events 서버 전용 fetch (S230-5)

   분리 사유 (ADR-009 · DEC-16 productsServer 답습):
   - 기존 lib/cafeEventsServer.ts 는 B2C SSR (getActiveCafeEvent / getComingCafeEvent
     `'use cache'` + cacheTag) + admin variant (`listCafeEventsAdmin`) 가 한 파일에 혼재.
     **Locality 부재** — admin 데이터 로직이 lib/ 루트에 위치하여 ordersServer/
     usersServer/subscriptionsServer/productsServer 패턴과 불일치.
   - admin variant 분리 후: lib/cafeEventsServer.ts = B2C only / lib/admin/
     cafeEventsServer.ts = admin only.

   역할:
   - listCafeEventsAdmin() — /admin/cafe-events 목록 (전체 sort by start_date desc)

   설계 (productsServer.ts 답습):
   - createRouteHandlerClient (admin 인증 cookies) — admin 페이지 일관 패턴
   - cache 미사용 — 어드민 항상 최신
   - 호출 실패 시 [] graceful fallback
   - RLS: cafe_events_select_public (035) 가 모든 SELECT 허용 → admin 세션이면 무조건 통과

   참조:
   - ADR-009 (admin architecture · DEC-16)
   - 035_cafe_events.sql
   - lib/cafeEvents.ts (헬퍼 + parseCafeEventRow · client-safe)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { parseCafeEventRow, type CafeEvent } from '@/lib/cafeEvents';

const SELECT_COLS =
  'id, type, enabled, ' +
  'custom_html_path, image_path_desktop, image_path_tablet, image_path_mobile, ' +
  'aspect_desktop, aspect_tablet, aspect_mobile, ' +
  'image_alt, start_date, end_date, sort_order';

/**
 * 어드민 전체 목록 (enabled 무관). cache 미사용 — 어드민은 항상 최신.
 * start_date desc 정렬 (NULL 후순).
 *
 * Next.js 16 dev 환경의 Supabase fetch AbortError 가 RSC streaming
 * timing 이슈로 간헐 발생 → 최대 2회 retry. production 영향 없음.
 */
export async function listCafeEventsAdmin(): Promise<CafeEvent[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = await createRouteHandlerClient();
    const { data, error } = await client
      .from('cafe_events')
      .select(SELECT_COLS)
      .order('start_date', { ascending: false, nullsFirst: false });

    if (error) {
      const msg = error.message ?? '';
      const aborted = /abort/i.test(msg);
      if (aborted && attempt < 2) continue;
      console.error('[listCafeEventsAdmin] query failed', {
        code: error.code,
        message: msg.slice(0, 200),
        attempt,
      });
      return [];
    }
    if (!data) return [];

    const parsed: CafeEvent[] = [];
    for (const row of data) {
      const ev = parseCafeEventRow(row);
      if (ev) parsed.push(ev);
    }
    return parsed;
  }
  return [];
}
