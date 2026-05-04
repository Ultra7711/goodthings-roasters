import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   lib/cafeEventsServer.ts — cafe_events 서버 fetch (S149 V2 §2.5 PR-1a)

   역할:
   - getActiveCafeEvent() — 현재 활성 1개 (자문 §5.3 우선순위)
   - getComingCafeEvent() — 7일 내 시작 이벤트 (자문 §5.3 예고)
   - listCafeEventsAdmin() — 어드민 전체 (sort by start_date desc)

   설계:
   - server-only 격리.
   - cookies() 무관 anon 클라이언트 (RLS public SELECT 허용).
   - 'use cache' + cacheTag('cafe-events') — 어드민 변경 시 revalidateTag.
   - 호출 실패 시 null/[] 반환 (메인 사이트 graceful 표시).

   참조:
   - lib/siteSettingsServer.ts (동일 패턴)
   - 035_cafe_events.sql
   ══════════════════════════════════════════════════════════════════════════ */

import { cacheTag } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  parseCafeEventRow,
  selectActiveEvent,
  selectComingEvent,
  type CafeEvent,
} from './cafeEvents';

/** revalidateTag 로 무효화. 어드민 actions 와 일치. */
export const CAFE_EVENTS_CACHE_TAG = 'cafe-events';

let cachedClient: SupabaseClient | null = null;

function getAnonClient(): SupabaseClient {
  if (!cachedClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        '[cafeEventsServer] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 미설정',
      );
    }
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

async function fetchAllRows(): Promise<CafeEvent[]> {
  const client = getAnonClient();
  const { data, error } = await client
    .from('cafe_events')
    .select(
      'id, type, enabled, eyebrow, h4, meta, description, image_path, image_alt, ' +
        'start_date, end_date, recurring, linked_menu_slug, season_label, partner_name, ' +
        'cta_target, sort_order',
    )
    .eq('enabled', true);

  if (error) {
    console.error('[cafeEventsServer] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
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

/**
 * 메인 §2.5 카페 메뉴 chapter 가 fetch.
 * 자문 §5.3 우선순위 적용 후 활성 1개.
 */
export async function getActiveCafeEvent(): Promise<CafeEvent | null> {
  'use cache';
  cacheTag(CAFE_EVENTS_CACHE_TAG);

  const events = await fetchAllRows();
  return selectActiveEvent(events);
}

/**
 * 자문 §5.3 — active 0 + 7일 내 시작 이벤트 있으면 Coming 표시.
 * 호출부는 active=null 인 경우에만 이 함수를 추가 호출.
 */
export async function getComingCafeEvent(): Promise<CafeEvent | null> {
  'use cache';
  cacheTag(CAFE_EVENTS_CACHE_TAG);

  const events = await fetchAllRows();
  return selectComingEvent(events);
}

/**
 * 어드민 전체 목록 (enabled 무관). cache 미사용 — 어드민은 항상 최신.
 */
export async function listCafeEventsAdmin(): Promise<CafeEvent[]> {
  const client = getAnonClient();
  const { data, error } = await client
    .from('cafe_events')
    .select(
      'id, type, enabled, eyebrow, h4, meta, description, image_path, image_alt, ' +
        'start_date, end_date, recurring, linked_menu_slug, season_label, partner_name, ' +
        'cta_target, sort_order',
    )
    .order('start_date', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('[listCafeEventsAdmin] query failed', {
      code: error.code,
      message: error.message?.slice(0, 200),
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
