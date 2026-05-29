import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   admin/bizInquiriesServer.ts — /admin/biz-inquiries 비즈 문의 목록 (S250-3)

   역할:
   - biz_inquiries 전체 fetch (admin RLS SELECT 통과 · 067 biz_inquiries_admin_select)
   - 시간 역순 정렬 (최신 문의 상단)

   설계 (newsletterServer 답습):
   - createRouteHandlerClient (admin RLS) — service role 불필요
   - 페이지네이션/검색 미적용 (N=200 fixed · 출시 직후 운영 — newsletter 정합)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';

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

const FETCH_LIMIT = 200;

export async function fetchBizInquiries(): Promise<BizInquiryRow[]> {
  const supabase = await createRouteHandlerClient();

  const { data, error } = await supabase
    .from('biz_inquiries')
    .select(
      'id, user_id, name, email, phone, company, biz_type, address, reg_num, equipment, current_bean, products, monthly_volume, delivery_cycle, message, status, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    console.error('[fetchBizInquiries] fetch failed', summarizePgError(error));
    return [];
  }

  const rows = (data ?? []) as Array<{
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
  }>;

  return rows.map((r) => ({
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
  }));
}
