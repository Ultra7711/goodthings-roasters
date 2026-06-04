/* ══════════════════════════════════════════════════════════════════════════
   notifications.ts — 어드민 상단 알림 벨 집계 (server)

   운영자 미처리 항목 4종을 1회 병렬 count 로 집계한다. DB 변경 없음 —
   service_role(getSupabaseAdmin) 로 head:true count 만 조회(RLS 우회).

   - 발송 대기 : orders status='paid' (결제완료·미발송)
   - 환불 요청 : orders status='refund_requested'
   - 송장 누락 : orders status='shipping' AND tracking_number IS NULL (이상건)
   - 신규 비즈문의 : biz_inquiries status='pending'

   각 항목 href 는 /admin/orders·/admin/biz-inquiries 전용 status 필터로 연결
   (orders 필터에 refund_requested·untracked 탭 추가 — 동 sprint).
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type AdminNotificationKey =
  | 'new_orders'
  | 'refund_requested'
  | 'untracked'
  | 'new_biz';

export type AdminNotificationItem = {
  key: AdminNotificationKey;
  label: string;
  count: number;
  href: string;
};

export type AdminNotifications = {
  items: AdminNotificationItem[];
  total: number;
};

/**
 * 미처리 항목 4종 count 집계.
 * 개별 count 실패는 0 으로 fallback(알림은 보조 기능 — 페이지 동작 방해 금지).
 */
export async function fetchAdminNotifications(): Promise<AdminNotifications> {
  const admin = getSupabaseAdmin();

  const [paidRes, refundRes, untrackedRes, bizRes] = await Promise.all([
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'paid'),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'refund_requested'),
    admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'shipping')
      .is('tracking_number', null),
    admin
      .from('biz_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  for (const [name, res] of [
    ['paid', paidRes],
    ['refund_requested', refundRes],
    ['untracked', untrackedRes],
    ['biz_pending', bizRes],
  ] as const) {
    if (res.error) {
      console.error('[fetchAdminNotifications] count failed', {
        target: name,
        code: res.error.code,
        message: res.error.message?.slice(0, 200),
      });
    }
  }

  const items: AdminNotificationItem[] = [
    {
      key: 'new_orders',
      label: '발송 대기 주문',
      count: paidRes.count ?? 0,
      href: '/admin/orders?status=new',
    },
    {
      key: 'refund_requested',
      label: '환불 요청',
      count: refundRes.count ?? 0,
      href: '/admin/orders?status=refund_requested',
    },
    {
      key: 'untracked',
      label: '송장 누락',
      count: untrackedRes.count ?? 0,
      href: '/admin/orders?status=untracked',
    },
    {
      key: 'new_biz',
      label: '신규 비즈문의',
      count: bizRes.count ?? 0,
      href: '/admin/biz-inquiries?status=pending',
    },
  ];

  const total = items.reduce((sum, it) => sum + it.count, 0);
  return { items, total };
}
