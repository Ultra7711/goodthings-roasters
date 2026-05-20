import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   admin/newsletterServer.ts — /admin/newsletter 구독자 목록 (S241 Phase 3)

   역할:
   - newsletter_subscribers 전체 fetch (admin RLS SELECT 통과)
   - profiles JOIN 으로 회원 이름 표시 (선택)
   - 시간 역순 정렬 (최신 가입 상단)

   RLS:
   - newsletter_admin_select (065 마이그) — public.is_admin((select auth.uid())) 통과

   설계 결정 (auditServer 답습):
   - 페이지네이션 미적용 (carry — N=200 fixed · 출시 직후 운영)
   - 검색/필터 미적용 (carry)
   - CSV export = 별도 sprint
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  userId: string | null;
  userName: string | null;
  status: 'active' | 'unsubscribed';
  source: 'newsletter_form' | 'signup_default' | 'admin' | 'other';
  createdAtIso: string;
  updatedAtIso: string;
};

const FETCH_LIMIT = 200;

export async function fetchNewsletterSubscribers(): Promise<NewsletterSubscriberRow[]> {
  const supabase = await createRouteHandlerClient();

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, user_id, status, source, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    console.error(
      '[fetchNewsletterSubscribers] fetch failed',
      summarizePgError(error),
    );
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    email: string;
    user_id: string | null;
    status: 'active' | 'unsubscribed';
    source: NewsletterSubscriberRow['source'];
    created_at: string;
    updated_at: string;
  }>;

  /* profiles JOIN — 회원 이름 lookup (선택) */
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')),
  );
  const nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    if (profileErr) {
      console.error(
        '[fetchNewsletterSubscribers] profiles lookup failed',
        summarizePgError(profileErr),
      );
    } else if (profileRows) {
      for (const p of profileRows as { id: string; full_name: string | null }[]) {
        if (p.full_name) nameMap.set(p.id, p.full_name);
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    userId: r.user_id,
    userName: r.user_id ? nameMap.get(r.user_id) ?? null : null,
    status: r.status,
    source: r.source,
    createdAtIso: r.created_at,
    updatedAtIso: r.updated_at,
  }));
}
