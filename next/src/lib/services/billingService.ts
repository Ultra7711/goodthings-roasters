/* ══════════════════════════════════════════════════════════════════════════
   billingService.ts — 토스 빌링(자동결제) 비즈 로직 (Phase 3-A · ADR-008)

   역할:
   - 빌링키 발급 (issueBillingMethod) — Toss API + DB INSERT
   - 첫 회차 결제 (chargeFirstCycle) — Toss API + atomic RPC (042)
   - 카드 목록/삭제/기본 변경 — service_role 직접 쿼리

   원칙:
   - billing_methods · subscription_billing_failures = service-role only RLS
     → 본 모듈은 supabaseAdmin 만 사용, userId 명시 필터로 타인 보호.
   - billing_key 는 응답 type 에서 제외 (BillingMethodForUser).
   - 첫 회차 실패 = throw (사용자 재등록 유도). cron 재시도는 Phase 3-C.
   - 혼합 카트 처리는 Phase 3-B (CheckoutPayment 분기) 책임.

   참조:
   - docs/adr/ADR-008-toss-billing-integration.md §3
   - supabase/migrations/040_billing_methods_schema.sql
   - supabase/migrations/042_*.sql (process_billing_charge_success · set_default_billing_method)
   ══════════════════════════════════════════════════════════════════════════ */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  issueBillingAuthorization,
  chargeBilling,
  type TossBillingAuthorizationResponse,
  type TossBillingPaymentResponse,
} from '@/lib/payments/tossBillingClient';
import { TossApiError, TossNetworkError } from '@/lib/payments/tossClient';
import type { OrderItemType, DbSubscriptionPeriod } from '@/types/db';

/* ══════════════════════════════════════════
   에러
   ══════════════════════════════════════════ */

export type BillingServiceErrorCode =
  | 'profile_not_found'
  | 'customer_key_mismatch'
  | 'billing_method_not_found'
  | 'order_not_found'
  | 'order_not_pending'
  | 'no_subscription_items'
  | 'duplicate_subscription'
  | 'toss_authorization_failed'
  | 'toss_charge_failed'
  | 'charge_not_done';

export class BillingServiceError extends Error {
  readonly code: BillingServiceErrorCode;
  readonly detail?: string;
  readonly cause?: unknown;

  constructor(code: BillingServiceErrorCode, detail?: string, cause?: unknown) {
    super(code);
    this.name = 'BillingServiceError';
    this.code = code;
    this.detail = detail;
    this.cause = cause;
  }
}

/* ══════════════════════════════════════════
   공개 타입 (billing_key 제외 — 클라이언트 응답용)
   ══════════════════════════════════════════ */

export type BillingMethodForUser = {
  id: string;
  method: 'card' | 'transfer';
  cardCompany: string | null;
  cardNumberMasked: string | null;
  bankName: string | null;
  accountNumberMasked: string | null;
  isDefault: boolean;
  expiresAt: string | null;
  registeredAt: string;
};

export type ChargeFirstCycleResult = {
  paymentKey: string;
  status: string;
  subscriptionIds: string[];
};

/* ══════════════════════════════════════════
   내부 헬퍼
   ══════════════════════════════════════════ */

/** Toss 응답 카드번호(마스킹 형태 다양) → '****-****-****-1234' 표준화. */
function maskCardNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  const last4 = digits.slice(-4).padStart(4, '0');
  return `****-****-****-${last4}`;
}

/** Toss 빌링 응답에서 method 분기 결정. card 우선, transfers 차순. */
function resolveMethodFromAuth(
  res: TossBillingAuthorizationResponse,
): 'card' | 'transfer' {
  if (res.card) return 'card';
  if (res.transfers && res.transfers.length > 0) return 'transfer';
  // 토스 docs 상 둘 중 하나는 반드시 존재. 방어적 fallback.
  throw new BillingServiceError(
    'toss_authorization_failed',
    'response missing card and transfers',
  );
}

/* ══════════════════════════════════════════
   1. 빌링키 발급
   ══════════════════════════════════════════ */

/**
 * authKey → Toss 빌링키 발급 → billing_methods INSERT.
 *
 * 사전 검증:
 * - userId 의 profiles.customer_key 가 입력 customerKey 와 일치 필수
 *   (NOT_MATCHES_CUSTOMER_KEY 사전 차단).
 * - 기존 active billing_methods 카운트 0 → 신규를 default 자동 설정.
 *
 * @throws BillingServiceError | TossApiError | TossNetworkError
 */
export async function issueBillingMethod(input: {
  authKey: string;
  customerKey: string;
  userId: string;
}): Promise<{ billingMethodId: string; isDefault: boolean }> {
  const admin = getSupabaseAdmin();

  /* customer_key 일치 검증 (clientside 변조 방지) */
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('customer_key')
    .eq('id', input.userId)
    .maybeSingle<{ customer_key: string }>();
  if (profileErr) throw profileErr;
  if (!profile) throw new BillingServiceError('profile_not_found');
  if (profile.customer_key !== input.customerKey) {
    throw new BillingServiceError('customer_key_mismatch');
  }

  /* Toss 빌링키 발급 */
  let issued: TossBillingAuthorizationResponse;
  try {
    issued = await issueBillingAuthorization({
      authKey: input.authKey,
      customerKey: input.customerKey,
    });
  } catch (err) {
    if (err instanceof TossApiError || err instanceof TossNetworkError) {
      throw new BillingServiceError('toss_authorization_failed', err.message, err);
    }
    throw err;
  }

  /* method 분기 + 마스킹 정보 추출 */
  const method = resolveMethodFromAuth(issued);
  const card = method === 'card' ? issued.card : undefined;
  const transfer =
    method === 'transfer' && issued.transfers && issued.transfers.length > 0
      ? issued.transfers[0]
      : undefined;

  /* default 자동 결정 — 첫 카드면 true */
  const { count, error: countErr } = await admin
    .from('billing_methods')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .is('deleted_at', null);
  if (countErr) throw countErr;
  const isDefault = (count ?? 0) === 0;

  /* billing_methods INSERT */
  const { data: inserted, error: insertErr } = await admin
    .from('billing_methods')
    .insert({
      user_id: input.userId,
      billing_key: issued.billingKey,
      method,
      card_company: card ? card.issuerCode : null,
      card_number_masked: card ? maskCardNumber(card.number) : null,
      bank_name: transfer ? transfer.bankName : null,
      account_number_masked: transfer
        ? maskCardNumber(transfer.bankAccountNumber)
        : null,
      is_default: isDefault,
      // expires_at 은 토스 빌링키 발급 응답에 명시 없음 — 별도 카드 정보 API 또는 미저장.
      // Phase 3-D 카드 만료 알림 작업 시 채울 것.
      expires_at: null,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertErr) throw insertErr;
  if (!inserted) throw new BillingServiceError('toss_authorization_failed', 'insert empty');

  return { billingMethodId: inserted.id, isDefault };
}

/* ══════════════════════════════════════════
   2. 첫 회차 결제
   ══════════════════════════════════════════ */

type SubscriptionItemForCharge = {
  product_slug: string;
  product_name: string;
  product_volume: string | null;
  product_image_src: string | null;
  cycle: DbSubscriptionPeriod;
};

/**
 * 빌링키로 첫 회차 결제 호출 + 성공 시 atomic 후처리 (042 RPC).
 *
 * 흐름:
 * 1) order + items + billing_method + customer_key lookup (소유권 검증)
 * 2) order_items 의 subscription item 추출
 * 3) 사전 중복 검증 (subscriptions_active_unique 활용 SELECT)
 * 4) Toss chargeBilling 호출
 * 5) status='DONE' → process_billing_charge_success RPC (subscriptions INSERT +
 *    orders.status='paid' + payments INSERT 원자 처리)
 *
 * @throws BillingServiceError | TossApiError | TossNetworkError
 */
export async function chargeFirstCycle(input: {
  orderId: string;
  userId: string;
  billingMethodId: string;
}): Promise<ChargeFirstCycleResult> {
  const admin = getSupabaseAdmin();

  /* order + items lookup (소유권 + status 가드) */
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      `id, order_number, user_id, status, total_amount,
       order_items (product_slug, product_name, product_volume, product_image_src,
                    item_type, subscription_period)`,
    )
    .eq('id', input.orderId)
    .eq('user_id', input.userId)
    .maybeSingle<{
      id: string;
      order_number: string;
      user_id: string;
      status: string;
      total_amount: number;
      order_items: Array<{
        product_slug: string;
        product_name: string;
        product_volume: string | null;
        product_image_src: string | null;
        item_type: OrderItemType;
        subscription_period: DbSubscriptionPeriod | null;
      }>;
    }>();
  if (orderErr) throw orderErr;
  if (!order) throw new BillingServiceError('order_not_found');
  if (order.status !== 'pending') throw new BillingServiceError('order_not_pending');

  /* billing_method lookup (소유권 + active 가드) */
  const { data: billingMethod, error: bmErr } = await admin
    .from('billing_methods')
    .select('id, billing_key, user_id, deleted_at')
    .eq('id', input.billingMethodId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; billing_key: string }>();
  if (bmErr) throw bmErr;
  if (!billingMethod) throw new BillingServiceError('billing_method_not_found');

  /* customer_key lookup */
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('customer_key')
    .eq('id', input.userId)
    .maybeSingle<{ customer_key: string }>();
  if (profErr) throw profErr;
  if (!profile) throw new BillingServiceError('profile_not_found');

  /* subscription items 추출 */
  const subscriptionItems: SubscriptionItemForCharge[] = order.order_items
    .filter(
      (it) =>
        it.item_type === 'subscription' && it.subscription_period !== null,
    )
    .map((it) => ({
      product_slug: it.product_slug,
      product_name: it.product_name,
      product_volume: it.product_volume,
      product_image_src: it.product_image_src,
      cycle: it.subscription_period as DbSubscriptionPeriod,
    }));
  if (subscriptionItems.length === 0) {
    throw new BillingServiceError('no_subscription_items');
  }

  /* 사전 중복 검증 (subscriptions_active_unique 활용) */
  for (const item of subscriptionItems) {
    const { data: existing, error: dupErr } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', input.userId)
      .eq('product_slug', item.product_slug)
      .eq('cycle', item.cycle)
      .eq('status', 'active')
      .maybeSingle<{ id: string }>();
    if (dupErr) throw dupErr;
    if (existing) {
      throw new BillingServiceError('duplicate_subscription', item.product_slug);
    }
  }

  /* Toss 빌링 결제 호출 */
  let payment: TossBillingPaymentResponse;
  try {
    payment = await chargeBilling({
      billingKey: billingMethod.billing_key,
      customerKey: profile.customer_key,
      amount: order.total_amount,
      orderId: order.order_number,
      orderName: orderNameFromItems(order.order_items),
    });
  } catch (err) {
    if (err instanceof TossApiError || err instanceof TossNetworkError) {
      throw new BillingServiceError('toss_charge_failed', err.message, err);
    }
    throw err;
  }

  /* status 가드 — 'DONE' 외는 후처리 안 함 (호출자가 분기) */
  if (payment.status !== 'DONE') {
    throw new BillingServiceError('charge_not_done', payment.status);
  }

  /* atomic 후처리 RPC (042) */
  const { data: rpcResult, error: rpcErr } = await admin
    .rpc('process_billing_charge_success', {
      p_order_id: order.id,
      p_billing_method_id: billingMethod.id,
      p_payment_key: payment.paymentKey,
      p_total_amount: payment.totalAmount,
      p_subscription_items: subscriptionItems,
      p_raw_response: payment,
    })
    .single<{ subscription_ids: string[] }>();
  if (rpcErr) throw rpcErr;
  if (!rpcResult) {
    throw new BillingServiceError('toss_charge_failed', 'rpc empty');
  }

  return {
    paymentKey: payment.paymentKey,
    status: payment.status,
    subscriptionIds: rpcResult.subscription_ids ?? [],
  };
}

function orderNameFromItems(
  items: ReadonlyArray<{ product_name: string }>,
): string {
  if (items.length === 0) return '주문 상품';
  if (items.length === 1) return items[0].product_name.slice(0, 100);
  // "산뜻한 오후 외 N건" 형식, 100자 안전.
  return `${items[0].product_name.slice(0, 80)} 외 ${items.length - 1}건`;
}

/* ══════════════════════════════════════════
   3. 카드 목록
   ══════════════════════════════════════════ */

export async function listBillingMethods(
  userId: string,
): Promise<BillingMethodForUser[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('billing_methods')
    .select(
      `id, method, card_company, card_number_masked,
       bank_name, account_number_masked,
       is_default, expires_at, registered_at`,
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('registered_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    method: row.method as 'card' | 'transfer',
    cardCompany: (row.card_company as string | null) ?? null,
    cardNumberMasked: (row.card_number_masked as string | null) ?? null,
    bankName: (row.bank_name as string | null) ?? null,
    accountNumberMasked: (row.account_number_masked as string | null) ?? null,
    isDefault: row.is_default as boolean,
    expiresAt: (row.expires_at as string | null) ?? null,
    registeredAt: row.registered_at as string,
  }));
}

/* ══════════════════════════════════════════
   4. soft delete
   ══════════════════════════════════════════ */

/**
 * 카드 soft delete + (선택) default 자동 이전.
 * 삭제된 카드가 default 였으면 가장 최근 등록된 다른 active 카드를 default 로.
 */
export async function softDeleteBillingMethod(input: {
  billingMethodId: string;
  userId: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();

  /* 소유권 + active 검증 */
  const { data: target, error: lookupErr } = await admin
    .from('billing_methods')
    .select('id, is_default')
    .eq('id', input.billingMethodId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; is_default: boolean }>();
  if (lookupErr) throw lookupErr;
  if (!target) throw new BillingServiceError('billing_method_not_found');

  /* soft delete */
  const { error: delErr } = await admin
    .from('billing_methods')
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq('id', target.id);
  if (delErr) throw delErr;

  /* 기존 default 였으면 다른 카드를 default 로 자동 이전 (가장 최근 등록) */
  if (target.is_default) {
    const { data: candidate, error: candErr } = await admin
      .from('billing_methods')
      .select('id')
      .eq('user_id', input.userId)
      .is('deleted_at', null)
      .order('registered_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (candErr) throw candErr;
    if (candidate) {
      const { error: updErr } = await admin
        .from('billing_methods')
        .update({ is_default: true })
        .eq('id', candidate.id);
      if (updErr) throw updErr;
    }
  }
}

/* ══════════════════════════════════════════
   5. default 변경
   ══════════════════════════════════════════ */

/**
 * default 카드 변경 — 042 RPC `set_default_billing_method` 로 atomic 처리.
 * partial unique index `billing_methods_user_default_uniq` 보호 하 두 UPDATE 순서.
 */
export async function setDefaultBillingMethod(input: {
  billingMethodId: string;
  userId: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc('set_default_billing_method', {
    p_billing_method_id: input.billingMethodId,
    p_user_id: input.userId,
  });
  if (error) {
    if ((error as { message?: string }).message?.includes('not_found')) {
      throw new BillingServiceError('billing_method_not_found');
    }
    throw error;
  }
}
