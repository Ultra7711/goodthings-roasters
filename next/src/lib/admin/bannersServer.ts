import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/admin/bannersServer.ts — /admin 배너 어드민 fetch (S270 Phase 3b · 071)

   분리 사유 (ADR-009 · DEC-16 productsServer 답습):
   - B2C 측 lib/bannersServer.ts 는 'use cache' + cacheTag (anon SELECT).
   - admin variant 는 createRouteHandlerClient (admin 인증 cookies) + cache 미사용.
     → lib/admin/bannersServer.ts 로 분리.

   역할:
   - listBannersAdmin(kind) — /admin/cafe-events + /admin/signatures 목록 fetch
     (kind 별 + start_date desc · NULL 후순 · enabled 무관)

   설계 (lib/admin/productsServer 답습 · ADR-009 DEC-16):
   - createRouteHandlerClient — 어드민 페이지 일관 패턴
   - cache 미사용 — 어드민 항상 최신
   - 실패 시 [] graceful fallback
   - RLS: banners_select_public (071) 가 모든 SELECT 허용 → admin 세션이면 무조건 통과
   - Next.js 16 dev 환경 AbortError 3 retry (RSC streaming timing)

   참조:
   - ADR-009 (admin architecture · DEC-16)
   - 071_banners_unified.sql
   - lib/banners.ts (Banner schema + parseBannerRow · client-safe)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { parseBannerRow, type Banner, type BannerKind } from '@/lib/banners';

const SELECT_COLS =
  'id, kind, enabled, internal_label, ' +
  'custom_html_path, image_path_desktop, image_path_tablet, image_path_mobile, ' +
  'image_blur_desktop, image_blur_tablet, image_blur_mobile, ' +
  'aspect_desktop, aspect_tablet, aspect_mobile, ' +
  'image_alt, headline_text, subhead_text, cta_text, cta_href, ' +
  'start_date, end_date, sort_order';

export async function listBannersAdmin(kind: BannerKind): Promise<Banner[]> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = await createRouteHandlerClient();
    const { data, error } = await client
      .from('banners')
      .select(SELECT_COLS)
      .eq('kind', kind)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      const msg = error.message ?? '';
      const aborted = /abort/i.test(msg);
      if (aborted && attempt < 2) continue;
      // eslint-disable-next-line no-console
      console.error('[listBannersAdmin] query failed', {
        code: error.code,
        message: msg.slice(0, 200),
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
