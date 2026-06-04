import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   ordersServer.ts — /admin/orders 서버 전용 fetcher (S128 Group B)

   분리 이유:
   - lib/admin/orders.ts 는 클라이언트 컴포넌트(OrdersTableClient) 가 매핑
     헬퍼(타입·상수·describeStatus 등) 를 import 한다.
   - createRouteHandlerClient 가 next/headers 를 가져오므로 클라이언트 번들에
     섞이면 build 실패. server-only 경계로 격리.

   참조:
   - 030_admin_orders_rls.sql (orders_select_admin · admin_orders_status_counts)
   - lib/admin/orders.ts       (순수 헬퍼)
   ══════════════════════════════════════════════════════════════════════════ */

import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { summarizePgError } from './errors';
import { type AdminListResult, applyRange, applyIlikeSearch } from './listHelpers';
import {
  CANCELLED_GROUP,
  PAGE_SIZE,
  describePayment,
  parseSearchParams,
  periodToSinceIso,
  sanitizeSearchQuery,
  summarizeItems,
  itemsToLines,
  type AdminOrdersSearchParams,
  type DbOrderStatus,
  type ListedOrder,
  type StatusTabKey,
} from './orders';

export type OrderDetailItem = {
  productName: string;
  productSlug: string;
  productVolume: string | null;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  lineTotal: number;
  itemType: 'normal' | 'subscription';
  subscriptionPeriod: string | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  createdAtIso: string;
  status: DbOrderStatus;
  customer: {
    name: string;
    email: string;
    phone: string;
    isMember: boolean;
    joinedAtIso: string | null;
    totalOrders: number;
  };
  items: OrderDetailItem[];
  summary: {
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    totalAmount: number;
  };
  payment: {
    method: 'card' | 'transfer';
    methodLabel: string;
    bankName: string | null;
    depositorName: string | null;
    paidAtIso: string | null;
    providerPaymentKey: string | null;
  };
  shipping: {
    name: string;
    phone: string;
    zipcode: string;
    addr1: string;
    addr2: string | null;
    messageCode: string | null;
    messageCustom: string | null;
  };
  dispatch: {
    trackingNumber: string | null;
    carrier: string | null;
    shippedAtIso: string | null;
  };
  adminNotes: string | null;
};

export type AdminOrdersResult = AdminListResult<
  ListedOrder,
  StatusTabKey,
  AdminOrdersSearchParams
>;

type OrderItemRow = {
  product_name: string;
  product_volume: string | null;
  quantity: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  contact_email: string;
  shipping_name: string;
  total_amount: number;
  payment_method: 'card' | 'transfer';
  status: DbOrderStatus;
  order_items: OrderItemRow[] | null;
};

/**
 * /admin/orders 데이터 fetch.
 *
 * 1) RPC `admin_orders_status_counts` (탭 카운트, 1쿼리)
 * 2) orders + order_items (status/period/payment/q 필터, 페이지네이션)
 *
 * RLS:
 * - admin 세션이면 030 의 orders_select_admin / order_items_select_admin 통과.
 * - 비admin 세션이면 RPC 가 insufficient_privilege raise → 빈 카운트로 fallback.
 */
export async function fetchAdminOrders(
  searchParamsRaw: Record<string, string | string[] | undefined>,
): Promise<AdminOrdersResult> {
  const filters = parseSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  /* 1) 탭 카운트 — RPC(주요 5탭) + 환불신청·송장누락 head count (전용 필터).
     refund_requested 는 RPC 의 cancelled 묶음에 합쳐져 분리 불가 → 별도 count.
     untracked = shipping 인데 tracking 없는 이상건 → 별도 count. */
  const [countsRes, refundRes, untrackedRes] = await Promise.all([
    supabase.rpc('admin_orders_status_counts'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'refund_requested'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'shipping')
      .is('tracking_number', null),
  ]);
  if (countsRes.error) {
    console.error('[fetchAdminOrders] counts rpc failed', {
      code: countsRes.error.code,
      message: countsRes.error.message?.slice(0, 200),
    });
  }
  const countsRaw = (countsRes.data ?? {}) as Record<string, number>;
  const counts: AdminOrdersResult['counts'] = {
    all:              Number(countsRaw.all       ?? 0),
    new:              Number(countsRaw.new       ?? 0),
    shipping:         Number(countsRaw.shipping  ?? 0),
    delivered:        Number(countsRaw.delivered ?? 0),
    cancelled:        Number(countsRaw.cancelled ?? 0),
    refund_requested: refundRes.count ?? 0,
    untracked:        untrackedRes.count ?? 0,
  };

  /* 2) orders + items 쿼리 */
  let query = applyRange(
    supabase
      .from('orders')
      .select(
        `id, order_number, created_at, contact_email, shipping_name,
         total_amount, payment_method, status,
         order_items ( product_name, product_volume, quantity )`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false }),
    filters.page,
    PAGE_SIZE,
  );

  if (filters.status === 'new')             query = query.eq('status', 'paid');
  else if (filters.status === 'shipping')   query = query.eq('status', 'shipping');
  else if (filters.status === 'delivered')  query = query.eq('status', 'delivered');
  else if (filters.status === 'cancelled')  query = query.in('status', CANCELLED_GROUP);
  else if (filters.status === 'refund_requested') query = query.eq('status', 'refund_requested');
  else if (filters.status === 'untracked')  query = query.eq('status', 'shipping').is('tracking_number', null);
  else                                      query = query.neq('status', 'pending'); /* 'all' 탭: pending 제외 (S171) */

  const sinceIso = periodToSinceIso(filters.period);
  if (sinceIso) query = query.gte('created_at', sinceIso);

  if (filters.payment !== 'all') query = query.eq('payment_method', filters.payment);

  query = applyIlikeSearch(query, sanitizeSearchQuery(filters.q), [
    'order_number',
    'contact_email',
    'shipping_name',
  ]);

  const { data, count, error } = await query;
  if (error) {
    console.error('[fetchAdminOrders] query failed', summarizePgError(error));
    return { rows: [], total: 0, counts, filters };
  }

  const rows: ListedOrder[] = ((data ?? []) as OrderRow[]).map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    createdAtIso: r.created_at,
    customerName: r.shipping_name,
    contactEmail: r.contact_email,
    itemsLabel: summarizeItems(r.order_items ?? []),
    itemsStructured: itemsToLines(r.order_items ?? []),
    totalAmount: r.total_amount,
    paymentLabel: describePayment(r.payment_method),
    status: r.status,
  }));

  return { rows, total: count ?? 0, counts, filters };
}

/* ── Export (CSV) 전용 fetcher (S232) ──────────────────────────────────
   fetchAdminOrders 와 동일 필터 (status/period/payment/q) 답습.
   PAGE_SIZE 무시 + MAX_ROWS 한도 + 배송 정보 포함 select.
   ───────────────────────────────────────────────────────────────────── */

type OrderExportRow = {
  id: string;
  order_number: string;
  created_at: string;
  contact_email: string;
  contact_phone: string | null;
  shipping_name: string;
  shipping_phone: string | null;
  shipping_zipcode: string | null;
  shipping_addr1: string | null;
  shipping_addr2: string | null;
  total_amount: number;
  payment_method: 'card' | 'transfer';
  status: DbOrderStatus;
  order_items: OrderItemRow[] | null;
};

export type ListedOrderForExport = {
  id: string;
  orderNumber: string;
  createdAtIso: string;
  customerName: string;
  contactEmail: string;
  contactPhone: string | null;
  shippingPhone: string | null;
  shippingZipcode: string | null;
  shippingAddr1: string | null;
  shippingAddr2: string | null;
  itemsLabel: string;
  totalAmount: number;
  paymentLabel: string;
  status: DbOrderStatus;
};

export type AdminOrdersExportResult = {
  rows: ListedOrderForExport[];
  truncated: boolean;
};

/** 행 수 상한 + 1 fetch → truncated 판정 (lib/admin/csvExport MAX_EXPORT_ROWS 와 정합). */
export async function fetchAdminOrdersForExport(
  searchParamsRaw: Record<string, string | string[] | undefined>,
  maxRows: number,
): Promise<AdminOrdersExportResult> {
  const filters = parseSearchParams(searchParamsRaw);
  const supabase = await createRouteHandlerClient();

  let query = supabase
    .from('orders')
    .select(
      `id, order_number, created_at, contact_email, contact_phone,
       shipping_name, shipping_phone, shipping_zipcode, shipping_addr1, shipping_addr2,
       total_amount, payment_method, status,
       order_items ( product_name, product_volume, quantity )`,
    )
    .order('created_at', { ascending: false })
    .range(0, maxRows);

  if (filters.status === 'new')             query = query.eq('status', 'paid');
  else if (filters.status === 'shipping')   query = query.eq('status', 'shipping');
  else if (filters.status === 'delivered')  query = query.eq('status', 'delivered');
  else if (filters.status === 'cancelled')  query = query.in('status', CANCELLED_GROUP);
  else if (filters.status === 'refund_requested') query = query.eq('status', 'refund_requested');
  else if (filters.status === 'untracked')  query = query.eq('status', 'shipping').is('tracking_number', null);
  else                                      query = query.neq('status', 'pending');

  const sinceIso = periodToSinceIso(filters.period);
  if (sinceIso) query = query.gte('created_at', sinceIso);

  if (filters.payment !== 'all') query = query.eq('payment_method', filters.payment);

  query = applyIlikeSearch(query, sanitizeSearchQuery(filters.q), [
    'order_number',
    'contact_email',
    'shipping_name',
  ]);

  const { data, error } = await query;
  if (error) {
    console.error('[fetchAdminOrdersForExport] query failed', summarizePgError(error));
    return { rows: [], truncated: false };
  }

  const all = (data ?? []) as OrderExportRow[];
  const truncated = all.length > maxRows;
  const trimmed = truncated ? all.slice(0, maxRows) : all;

  const rows: ListedOrderForExport[] = trimmed.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    createdAtIso: r.created_at,
    customerName: r.shipping_name,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    shippingPhone: r.shipping_phone,
    shippingZipcode: r.shipping_zipcode,
    shippingAddr1: r.shipping_addr1,
    shippingAddr2: r.shipping_addr2,
    itemsLabel: summarizeItems(r.order_items ?? []),
    totalAmount: r.total_amount,
    paymentLabel: describePayment(r.payment_method),
    status: r.status,
  }));

  return { rows, truncated };
}

/* ── 상세 조회 ──────────────────────────────────────────────────────── */

type DetailRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: DbOrderStatus;
  user_id: string | null;
  contact_email: string;
  contact_phone: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_zipcode: string;
  shipping_addr1: string;
  shipping_addr2: string | null;
  shipping_message_code: string | null;
  shipping_message_custom: string | null;
  payment_method: 'card' | 'transfer';
  bank_name: string | null;
  depositor_name: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  admin_notes: string | null;
  order_items: Array<{
    product_name: string;
    product_slug: string;
    product_volume: string | null;
    quantity: number;
    unit_price: number;
    original_unit_price: number;
    line_total: number;
    item_type: 'normal' | 'subscription';
    subscription_period: string | null;
  }> | null;
};

/**
 * 어드민 주문 상세 조회.
 * - 1차: orders + order_items (RLS 030 admin select 통과)
 * - 2차 병렬: profiles(가입일) · 누적 주문 수 · payment_transactions (031 admin select)
 *
 * 비admin 호출이면 RLS 차단 → null. 페이지에서 not_found 처리.
 */
export async function fetchOrderDetail(orderNumber: string): Promise<OrderDetail | null> {
  const supabase = await createRouteHandlerClient();

  /* 1) order + items */
  const { data: orderRaw, error } = await supabase
    .from('orders')
    .select(
      `id, order_number, created_at, status,
       user_id, contact_email, contact_phone,
       shipping_name, shipping_phone, shipping_zipcode,
       shipping_addr1, shipping_addr2,
       shipping_message_code, shipping_message_custom,
       payment_method, bank_name, depositor_name,
       tracking_number, carrier, shipped_at,
       subtotal, shipping_fee, discount_amount, total_amount,
       admin_notes,
       order_items (
         product_name, product_slug, product_volume,
         quantity, unit_price, original_unit_price, line_total,
         item_type, subscription_period
       )`,
    )
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    console.error('[fetchOrderDetail] query failed', summarizePgError(error));
    return null;
  }
  if (!orderRaw) return null;

  const order = orderRaw as DetailRow;

  /* 2) 부가 정보 — 회원이면 가입일/누적 주문 / 결제 트랜잭션 */
  const profilePromise = order.user_id
    ? supabase
        .from('profiles')
        .select('created_at')
        .eq('id', order.user_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null } as const);

  const totalOrdersPromise = order.user_id
    ? supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', order.user_id)
    : Promise.resolve({ count: 0, error: null } as const);

  const paymentPromise = supabase
    .from('payment_transactions')
    .select('created_at, provider_payment_key')
    .eq('order_id', order.id)
    .eq('event_type', 'payment_approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [profileRes, totalOrdersRes, paymentRes] = await Promise.all([
    profilePromise,
    totalOrdersPromise,
    paymentPromise,
  ]);

  const joinedAtIso =
    profileRes && 'data' in profileRes && profileRes.data
      ? (profileRes.data as { created_at: string }).created_at
      : null;

  const totalOrders =
    totalOrdersRes && 'count' in totalOrdersRes && typeof totalOrdersRes.count === 'number'
      ? totalOrdersRes.count
      : 0;

  const paymentRow =
    paymentRes && 'data' in paymentRes && paymentRes.data
      ? (paymentRes.data as { created_at: string; provider_payment_key: string | null })
      : null;

  /* 결제수단 라벨 — 카드는 "카드", 계좌이체는 "계좌이체 · {은행} {예금주}" */
  let methodLabel = describePayment(order.payment_method);
  if (order.payment_method === 'transfer' && order.bank_name) {
    methodLabel = order.depositor_name
      ? `계좌이체 · ${order.bank_name} ${order.depositor_name}`
      : `계좌이체 · ${order.bank_name}`;
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    createdAtIso: order.created_at,
    status: order.status,
    customer: {
      name: order.shipping_name,
      email: order.contact_email,
      phone: order.contact_phone,
      isMember: order.user_id != null,
      joinedAtIso,
      totalOrders,
    },
    items: (order.order_items ?? []).map((it) => ({
      productName: it.product_name,
      productSlug: it.product_slug,
      productVolume: it.product_volume,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      originalUnitPrice: it.original_unit_price,
      lineTotal: it.line_total,
      itemType: it.item_type,
      subscriptionPeriod: it.subscription_period,
    })),
    summary: {
      subtotal: order.subtotal,
      shippingFee: order.shipping_fee,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount,
    },
    payment: {
      method: order.payment_method,
      methodLabel,
      bankName: order.bank_name,
      depositorName: order.depositor_name,
      paidAtIso: paymentRow?.created_at ?? null,
      providerPaymentKey: paymentRow?.provider_payment_key ?? null,
    },
    shipping: {
      name: order.shipping_name,
      phone: order.shipping_phone,
      zipcode: order.shipping_zipcode,
      addr1: order.shipping_addr1,
      addr2: order.shipping_addr2,
      messageCode: order.shipping_message_code,
      messageCustom: order.shipping_message_custom,
    },
    dispatch: {
      trackingNumber: order.tracking_number,
      carrier: order.carrier,
      shippedAtIso: order.shipped_at,
    },
    adminNotes: order.admin_notes,
  };
}
