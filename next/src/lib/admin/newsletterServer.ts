import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   admin/newsletterServer.ts — /admin/newsletter 구독자 fetch (S241 Phase 3 · S250-2 확장)

   - newsletter_subscribers admin RLS SELECT (065 newsletter_admin_select)
   - 상태 필터(active/unsubscribed) + 이메일 검색(q) + 페이지네이션 (S250-2)
   - profiles JOIN 으로 회원 이름 표시
   - CSV(XLSX) 내보내기용 fetch (usersServer 답습)

   설계: usersServer / listHelpers 답습.
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';
import { type AdminListResult, applyRange, applyIlikeSearch } from './listHelpers';
import {
  NEWSLETTER_PAGE_SIZE,
  parseNewsletterSearchParams,
  sanitizeNewsletterQuery,
  type NewsletterStatusTab,
  type NewsletterSearchParams,
} from './newsletter';
import type { NewsletterBlock } from './newsletterCompose';

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  userId: string | null;
  userName: string | null;
  status: 'active' | 'unsubscribed';
  source: 'newsletter_form' | 'signup_default' | 'admin' | 'other';
  createdAtIso: string;
};

type SubscriberDbRow = {
  id: string;
  email: string;
  user_id: string | null;
  status: 'active' | 'unsubscribed';
  source: NewsletterSubscriberRow['source'];
  created_at: string;
};

export type AdminNewsletterResult = AdminListResult<
  NewsletterSubscriberRow,
  NewsletterStatusTab,
  NewsletterSearchParams
>;

/* user_id → full_name 매핑 (profiles JOIN) */
async function lookupUserNames(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  rows: SubscriberDbRow[],
): Promise<Map<string, string>> {
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')),
  );
  const nameMap = new Map<string, string>();
  if (userIds.length === 0) return nameMap;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  if (error) {
    console.error('[newsletterServer] profiles lookup failed', summarizePgError(error));
    return nameMap;
  }
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    if (p.full_name) nameMap.set(p.id, p.full_name);
  }
  return nameMap;
}

function mapRow(r: SubscriberDbRow, nameMap: Map<string, string>): NewsletterSubscriberRow {
  return {
    id: r.id,
    email: r.email,
    userId: r.user_id,
    userName: r.user_id ? nameMap.get(r.user_id) ?? null : null,
    status: r.status,
    source: r.source,
    createdAtIso: r.created_at,
  };
}

export async function fetchNewsletterSubscribers(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminNewsletterResult> {
  const filters = parseNewsletterSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) status 카운트 (active / unsubscribed head:true) */
  const [activeRes, unsubRes] = await Promise.all([
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unsubscribed'),
  ]);
  if (activeRes.error) console.error('[newsletterServer] active count failed', summarizePgError(activeRes.error));
  if (unsubRes.error) console.error('[newsletterServer] unsub count failed', summarizePgError(unsubRes.error));

  const activeCount = activeRes.count ?? 0;
  const unsubCount = unsubRes.count ?? 0;
  const counts: AdminNewsletterResult['counts'] = {
    all: activeCount + unsubCount,
    active: activeCount,
    unsubscribed: unsubCount,
  };

  /* 2) 메인 쿼리 (status 필터 + q ilike(email) + 페이지네이션) */
  let query = applyRange(
    supabase
      .from('newsletter_subscribers')
      .select('id, email, user_id, status, source, created_at', { count: 'exact' })
      .order('created_at', { ascending: false }),
    filters.page,
    NEWSLETTER_PAGE_SIZE,
  );
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  query = applyIlikeSearch(query, sanitizeNewsletterQuery(filters.q), ['email']);

  const { data, count, error } = await query;
  if (error) {
    console.error('[newsletterServer] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  const dbRows = (data ?? []) as SubscriberDbRow[];
  const nameMap = await lookupUserNames(supabase, dbRows);
  return {
    rows: dbRows.map((r) => mapRow(r, nameMap)),
    total: count ?? 0,
    counts,
    filters,
  };
}

/* ── CSV export (usersServer 답습 · maxRows+1 truncated 판정) ─────────── */

export type NewsletterExportFilters = {
  status: NewsletterStatusTab;
  q: string;
};

export type NewsletterExportResult = {
  rows: NewsletterSubscriberRow[];
  truncated: boolean;
};

export async function fetchNewsletterSubscribersForExport(
  filters: NewsletterExportFilters,
  maxRows: number,
): Promise<NewsletterExportResult> {
  const supabase = await createRouteHandlerClient();

  let query = supabase
    .from('newsletter_subscribers')
    .select('id, email, user_id, status, source, created_at')
    .order('created_at', { ascending: false })
    .range(0, maxRows);
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  query = applyIlikeSearch(query, sanitizeNewsletterQuery(filters.q), ['email']);

  const { data, error } = await query;
  if (error) {
    console.error('[newsletterServer] export query failed', summarizePgError(error));
    return { rows: [], truncated: false };
  }

  const all = (data ?? []) as SubscriberDbRow[];
  const truncated = all.length > maxRows;
  const trimmed = truncated ? all.slice(0, maxRows) : all;
  const nameMap = await lookupUserNames(supabase, trimmed);
  return { rows: trimmed.map((r) => mapRow(r, nameMap)), truncated };
}

/* ── 발송 이력 (S250-2 Phase 2) ───────────────────────────────────────── */

export type NewsletterCampaignRow = {
  id: string;
  subject: string;
  blocks: NewsletterBlock[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'sent' | 'partial' | 'failed';
  sentAtIso: string | null;
  createdAtIso: string;
};

type CampaignDbRow = {
  id: string;
  subject: string;
  blocks: unknown;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: 'sent' | 'partial' | 'failed';
  sent_at: string | null;
  created_at: string;
};

const NEWSLETTER_CAMPAIGNS_LIMIT = 50;

/* 발송 이력 — admin RLS select (083 newsletter_campaigns_admin_select).
   blocks(jsonb) 는 복제 재발송용. 컴포저에서 재검증하므로 여기선 캐스트만. */
export async function fetchNewsletterCampaigns(): Promise<NewsletterCampaignRow[]> {
  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .select(
      'id, subject, blocks, recipient_count, sent_count, failed_count, status, sent_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(NEWSLETTER_CAMPAIGNS_LIMIT);
  if (error) {
    console.error('[newsletterServer] campaigns fetch failed', summarizePgError(error));
    return [];
  }
  return ((data ?? []) as CampaignDbRow[]).map((r) => ({
    id: r.id,
    subject: r.subject,
    blocks: Array.isArray(r.blocks) ? (r.blocks as NewsletterBlock[]) : [],
    recipientCount: r.recipient_count,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    status: r.status,
    sentAtIso: r.sent_at,
    createdAtIso: r.created_at,
  }));
}
