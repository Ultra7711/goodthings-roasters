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
import { classifyBillingError, computeRetryAt } from '@/lib/payments/billingErrorPolicy';
import { fetchProducts } from '@/lib/productsServer';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import type { OrderItemType, DbSubscriptionPeriod, DbPaymentMethod } from '@/types/db';

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
  | 'charge_not_done'
  /* R-1 회차 자동 청구 */
  | 'subscription_not_found'
  | 'subscription_not_active'
  | 'subscription_snapshot_missing'
  | 'no_default_address'
  | 'product_not_found'
  | 'already_charged_this_cycle';

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
  /** 가입 시점 단가 스냅샷 (105) — subscriptions.unit_price 저장용. */
  unit_price: number;
  /** 가입 시점 수량 스냅샷 (105) — subscriptions.quantity 저장용. */
  quantity: number;
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
                    item_type, subscription_period, unit_price, quantity)`,
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
        unit_price: number;
        quantity: number;
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
      unit_price: it.unit_price,
      quantity: it.quantity,
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

/* ══════════════════════════════════════════
   6. 회차 자동 청구 (R-1)
   ══════════════════════════════════════════ */

/** 회차 주문 약관 버전 — 가입 시 빌링 등록 동의에 근거 (R-4 약관 정합 예정). */
const RECURRING_TERMS_VERSION = 'subscription-recurring';

export type ChargeRecurringResult = {
  orderId: string;
  orderNumber: string;
  paymentKey: string;
  amount: number;
  nextDeliveryAt: string;
};

/**
 * subscription_billing_failures 에 실패 1건 기록 (분류 + retry_at 산정).
 * R-1 은 기록만 — paused 전환·재시도 실행은 R-3(dunning).
 */
async function recordBillingFailure(
  admin: ReturnType<typeof getSupabaseAdmin>,
  subscriptionId: string,
  errorCode: string,
  errorMessage: string | null,
): Promise<void> {
  /* 기록 실패가 청구 결과(원래 에러) 흐름을 가리지 않도록 내부에서 삼킨다.
     단 손실은 로그로 남겨 운영 추적 가능하게 한다(R-3 dunning 의존 데이터). */
  try {
    /* 기존 미해결 실패 횟수 → retry 스케줄 단계 결정 */
    const { count } = await admin
      .from('subscription_billing_failures')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_id', subscriptionId)
      .is('resolved_at', null);
    const attemptCount = count ?? 0;
    const retryAt = computeRetryAt(errorCode, attemptCount, Date.now());

    await admin.from('subscription_billing_failures').insert({
      subscription_id: subscriptionId,
      error_code: errorCode,
      error_message: errorMessage ? errorMessage.slice(0, 500) : null,
      retry_at: retryAt,
    });
  } catch (recErr) {
    console.error('[billing.recurring] failed to record billing failure', {
      subscriptionId,
      errorCode,
      ...(process.env.NODE_ENV !== 'production' && {
        msg:
          recErr instanceof Error
            ? recErr.message.slice(0, 200)
            : String(recErr).slice(0, 200),
      }),
    });
  }
}

/**
 * 정기배송 N회차(2회차+) 자동 청구.
 *
 * 흐름:
 *  1) subscription 조회 + active/스냅샷/빌링수단 가드
 *  2) billing_method(active) · 기본 배송지 · profile · 상품 카테고리 조회
 *     - 기본 배송지 없음 / 상품 단종 → 실패 기록 후 throw (청구 보류)
 *  3) 배송비 = site_settings 동적, 금액 = unit_price*quantity 스냅샷
 *  4) create_recurring_order RPC — 회차 주문(pending) 원자 생성 + 멱등 가드
 *  5) chargeBilling(Idempotency-Key) → DONE 검증
 *  6) process_recurring_billing_charge RPC — payments + order paid + next_delivery 전진
 *
 * 멱등: ① RPC 의 next_delivery_at>now() 가드(주 방어) ② Idempotency-Key(이중).
 *
 * @throws BillingServiceError
 */
export async function chargeRecurringCycle(input: {
  subscriptionId: string;
}): Promise<ChargeRecurringResult> {
  const admin = getSupabaseAdmin();

  /* 1) subscription 조회 + 상태/스냅샷 가드 */
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select(
      `id, user_id, product_slug, product_name, product_volume, product_image_src,
       cycle, status, next_delivery_at, billing_method_id, unit_price, quantity`,
    )
    .eq('id', input.subscriptionId)
    .maybeSingle<{
      id: string;
      user_id: string;
      product_slug: string;
      product_name: string;
      product_volume: string | null;
      product_image_src: string | null;
      cycle: DbSubscriptionPeriod;
      status: string;
      next_delivery_at: string;
      billing_method_id: string | null;
      unit_price: number | null;
      quantity: number | null;
    }>();
  if (subErr) throw subErr;
  if (!sub) throw new BillingServiceError('subscription_not_found');
  if (sub.status !== 'active') {
    throw new BillingServiceError('subscription_not_active', sub.status);
  }
  if (sub.unit_price == null || sub.quantity == null) {
    throw new BillingServiceError('subscription_snapshot_missing');
  }
  if (!sub.billing_method_id) {
    throw new BillingServiceError('billing_method_not_found');
  }

  /* 2) billing_method (active) */
  const { data: bm, error: bmErr } = await admin
    .from('billing_methods')
    .select('id, billing_key, method')
    .eq('id', sub.billing_method_id)
    .eq('user_id', sub.user_id)
    .is('deleted_at', null)
    .maybeSingle<{ id: string; billing_key: string; method: DbPaymentMethod }>();
  if (bmErr) throw bmErr;
  if (!bm) throw new BillingServiceError('billing_method_not_found');

  /* 3) 기본 배송지 — 없으면 청구 보류 + 실패 기록 */
  const { data: addr, error: addrErr } = await admin
    .from('addresses')
    .select('name, phone, zipcode, addr1, addr2')
    .eq('user_id', sub.user_id)
    .eq('is_default', true)
    .maybeSingle<{
      name: string;
      phone: string;
      zipcode: string;
      addr1: string;
      addr2: string | null;
    }>();
  if (addrErr) throw addrErr;
  if (!addr) {
    await recordBillingFailure(admin, sub.id, 'NO_DEFAULT_ADDRESS', '기본 배송지 미설정');
    throw new BillingServiceError('no_default_address');
  }

  /* 4) profile (contact + customerKey) */
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('customer_key, email, phone')
    .eq('id', sub.user_id)
    .maybeSingle<{ customer_key: string; email: string; phone: string | null }>();
  if (profErr) throw profErr;
  if (!profile) throw new BillingServiceError('profile_not_found');

  /* 5) 상품 카테고리 (order_items NOT NULL) — 단종 시 보류 */
  const products = await fetchProducts();
  const product = products.find((p) => p.slug === sub.product_slug);
  if (!product) {
    await recordBillingFailure(admin, sub.id, 'PRODUCT_NOT_FOUND', `상품 단종: ${sub.product_slug}`);
    throw new BillingServiceError('product_not_found', sub.product_slug);
  }

  /* 6) 배송비 — site_settings 동적 (orderService 인라인 규칙 동일) */
  const { shipping } = await fetchSiteSettings();
  const subtotal = sub.unit_price * sub.quantity;
  const freeThreshold = shipping.enabled
    ? shipping.free_threshold
    : Number.POSITIVE_INFINITY;
  const shippingFee = subtotal >= freeThreshold ? 0 : shipping.base_fee;

  const contactPhone = profile.phone ?? addr.phone;

  /* 7) 회차 주문(pending) 원자 생성 — 멱등 가드는 RPC 내부(next_delivery_at>now) */
  const { data: orderRow, error: orderErr } = await admin
    .rpc('create_recurring_order', {
      p_subscription_id: sub.id,
      p_contact_email: profile.email,
      p_contact_phone: contactPhone,
      p_shipping_name: addr.name,
      p_shipping_phone: addr.phone,
      p_shipping_zipcode: addr.zipcode,
      p_shipping_addr1: addr.addr1,
      p_shipping_addr2: addr.addr2 ?? '',
      p_product_category: product.category,
      p_shipping_fee: shippingFee,
      p_terms_version: RECURRING_TERMS_VERSION,
    })
    .single<{ order_id: string; order_number: string; total_amount: number }>();
  if (orderErr) {
    const msg = (orderErr as { message?: string }).message ?? '';
    if (msg.includes('already_charged_this_cycle')) {
      throw new BillingServiceError('already_charged_this_cycle');
    }
    if (msg.includes('subscription_not_active')) {
      throw new BillingServiceError('subscription_not_active');
    }
    if (msg.includes('snapshot_missing')) {
      throw new BillingServiceError('subscription_snapshot_missing');
    }
    if (msg.includes('billing_method')) {
      throw new BillingServiceError('billing_method_not_found');
    }
    throw orderErr;
  }
  if (!orderRow) {
    throw new BillingServiceError('order_not_found', 'create_recurring_order empty');
  }

  /* 8) 빌링 결제 — Idempotency-Key = 회차 식별(중복 출금 차단).
        키는 (구독, 이번 주기 예정일)로 deterministic. 동일 회차 재시도/동시호출 시
        토스가 첫 결과를 반환 → 출금 중복 0. payments.payment_key UNIQUE + orders 1:1
        과 함께, 동시 호출의 두 번째 회차 주문은 후처리에서 UNIQUE 위반으로 안전 차단된다.
        (완전한 동시 실행 제거는 R-2 스케줄러 advisory lock 으로 보강.) */
  const idempotencyKey = `recurring-${sub.id}-${new Date(sub.next_delivery_at).getTime()}`;
  let payment: TossBillingPaymentResponse;
  try {
    payment = await chargeBilling({
      billingKey: bm.billing_key,
      customerKey: profile.customer_key,
      amount: orderRow.total_amount,
      orderId: orderRow.order_number,
      orderName: sub.product_name.slice(0, 100),
      idempotencyKey,
    });
  } catch (err) {
    /* 토스 실패 → 분류 기록. 회차 주문 pending 은 cleanup(038/039) 이 정리. */
    if (err instanceof TossApiError) {
      await recordBillingFailure(admin, sub.id, err.code, err.message);
      throw new BillingServiceError('toss_charge_failed', err.code, err);
    }
    if (err instanceof TossNetworkError) {
      await recordBillingFailure(admin, sub.id, 'NETWORK_ERROR', err.message);
      throw new BillingServiceError('toss_charge_failed', 'network', err);
    }
    throw err;
  }

  if (payment.status !== 'DONE') {
    await recordBillingFailure(
      admin,
      sub.id,
      `STATUS_${payment.status}`,
      `unexpected status ${payment.status}`,
    );
    throw new BillingServiceError('charge_not_done', payment.status);
  }

  /* 9) 결제 성공 atomic 후처리 — payments + order paid + next_delivery 전진 */
  const { data: rpcResult, error: rpcErr } = await admin
    .rpc('process_recurring_billing_charge', {
      p_order_id: orderRow.order_id,
      p_subscription_id: sub.id,
      p_payment_key: payment.paymentKey,
      p_total_amount: payment.totalAmount,
      p_method: bm.method,
      p_raw_response: payment,
    })
    .single<{ payment_id: string; next_delivery_at: string }>();
  if (rpcErr) throw rpcErr;
  if (!rpcResult) throw new BillingServiceError('toss_charge_failed', 'rpc empty');

  /* 결제 audit — 성공 회차는 운영 가시성 위해 기록(민감정보 제외). */
  console.info('[billing.recurring] charged', {
    subscriptionId: sub.id,
    orderNumber: orderRow.order_number,
    amount: payment.totalAmount,
    nextDeliveryAt: rpcResult.next_delivery_at,
  });

  return {
    orderId: orderRow.order_id,
    orderNumber: orderRow.order_number,
    paymentKey: payment.paymentKey,
    amount: payment.totalAmount,
    nextDeliveryAt: rpcResult.next_delivery_at,
  };
}
