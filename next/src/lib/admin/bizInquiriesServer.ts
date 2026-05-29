import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   admin/bizInquiriesServer.ts — /admin/biz-inquiries 비즈 문의 목록 (S250-3 · S304)

   역할:
   - biz_inquiries fetch (admin RLS SELECT 통과 · 067 biz_inquiries_admin_select)
   - 상태 필터(신규/연락중/종결) + 검색(회사/담당자/이메일) + 페이지네이션 (S304)
   - 시간 역순 정렬 (최신 문의 상단)

   설계 (newsletterServer 1:1 답습):
   - createRouteHandlerClient (admin RLS) — service role 불필요
   - AdminListResult + applyRange + applyIlikeSearch (listHelpers)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';
import { type AdminListResult, applyRange, applyIlikeSearch } from './listHelpers';
import {
  BIZ_PAGE_SIZE,
  parseBizSearchParams,
  sanitizeBizQuery,
  type BizStatusTab,
  type BizSearchParams,
} from './bizInquiries';

export type BizInquiryStatus = 'pending' | 'contacted' | 'closed';

export type BizInquiryRow = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  bizType: string;
  address: string;
  regNum: string | null;
  equipment: string | null;
  currentBean: string | null;
  products: string[];
  monthlyVolume: string | null;
  deliveryCycle: string | null;
  message: string;
  status: BizInquiryStatus;
  createdAtIso: string;
};

type BizInquiryDbRow = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  biz_type: string;
  address: string;
  reg_num: string | null;
  equipment: string | null;
  current_bean: string | null;
  products: string[] | null;
  monthly_volume: string | null;
  delivery_cycle: string | null;
  message: string;
  status: BizInquiryStatus;
  created_at: string;
};

const SELECT_COLUMNS =
  'id, user_id, name, email, phone, company, biz_type, address, reg_num, equipment, current_bean, products, monthly_volume, delivery_cycle, message, status, created_at';

function mapRow(r: BizInquiryDbRow): BizInquiryRow {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    bizType: r.biz_type,
    address: r.address,
    regNum: r.reg_num,
    equipment: r.equipment,
    currentBean: r.current_bean,
    products: r.products ?? [],
    monthlyVolume: r.monthly_volume,
    deliveryCycle: r.delivery_cycle,
    message: r.message,
    status: r.status,
    createdAtIso: r.created_at,
  };
}

export type AdminBizInquiriesResult = AdminListResult<
  BizInquiryRow,
  BizStatusTab,
  BizSearchParams
>;

export async function fetchBizInquiries(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminBizInquiriesResult> {
  const filters = parseBizSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) status 카운트 (pending / contacted / closed head:true) */
  const [pendingRes, contactedRes, closedRes] = await Promise.all([
    supabase.from('biz_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('biz_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'contacted'),
    supabase.from('biz_inquiries').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
  ]);
  if (pendingRes.error) console.error('[fetchBizInquiries] pending count failed', summarizePgError(pendingRes.error));
  if (contactedRes.error) console.error('[fetchBizInquiries] contacted count failed', summarizePgError(contactedRes.error));
  if (closedRes.error) console.error('[fetchBizInquiries] closed count failed', summarizePgError(closedRes.error));

  const pendingCount = pendingRes.count ?? 0;
  const contactedCount = contactedRes.count ?? 0;
  const closedCount = closedRes.count ?? 0;
  const counts: AdminBizInquiriesResult['counts'] = {
    all: pendingCount + contactedCount + closedCount,
    pending: pendingCount,
    contacted: contactedCount,
    closed: closedCount,
  };

  /* 2) 메인 쿼리 (status 필터 + q ilike(company/name/email) + 페이지네이션) */
  let query = applyRange(
    supabase
      .from('biz_inquiries')
      .select(SELECT_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false }),
    filters.page,
    BIZ_PAGE_SIZE,
  );
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  query = applyIlikeSearch(query, sanitizeBizQuery(filters.q), ['company', 'name', 'email']);

  const { data, count, error } = await query;
  if (error) {
    console.error('[fetchBizInquiries] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  return {
    rows: ((data ?? []) as BizInquiryDbRow[]).map(mapRow),
    total: count ?? 0,
    counts,
    filters,
  };
}
