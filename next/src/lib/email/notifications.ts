/* ══════════════════════════════════════════════════════════════════════════
   email/notifications.ts — 트랜잭셔널 메일 fire-and-forget 래퍼

   원칙 (docs/email-infrastructure.md §10):
   - 이메일 실패는 결제·인증 플로우를 중단하지 않는다.
   - 모든 함수는 실패 시 console.error 만 남기고 resolve 한다.
   - 호출처에서 await 없이 void 로 호출해도 된다.

   DB 접근: getSupabaseAdmin() (service_role, RLS 우회)

   D-4 Pass 1 수정:
   - HIGH-2(code): welcome idempotencyKey 이메일 특수문자 정규화 (@ + 등 → _)
   - MEDIUM-1(code): sendShippingNotificationEmail as string 캐스트 제거
   - LOW-2(security): Supabase 에러 message 원문 → code 만 로깅
   ════════════════════════════════════════════════════════════════════════ */

import { sendEmail } from './sendEmail';
import { renderWelcomeEmail } from './templates/welcomeEmail';
import { renderOrderConfirmationEmail } from './templates/orderConfirmationEmail';
import { renderShippingNotificationEmail } from './templates/shippingNotificationEmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { DbPaymentMethod } from '@/types/db';

/* ─── 내부 DB 쿼리 ──────────────────────────────────────────────────────── */

type OrderRow = {
  id: string;
  /** Session 11 보안 #3-4a: 이메일 CTA 링크용 UUID v4. */
  public_token: string;
  contact_email: string;
  shipping_name: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  payment_method: DbPaymentMethod;
};

type OrderItemRow = {
  product_name: string;
  quantity: number;
  unit_price: number;
};

type ShippingOrderRow = {
  public_token: string;
  contact_email: string;
  shipping_name: string;
};

type VirtualAccountInfo = {
  bank: string | null;
  accountNumber: string;
  dueDate: string | null;
  customerName: string | null;
} | null;

async function fetchOrderForEmail(
  orderNumber: string,
): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  const admin = getSupabaseAdmin();

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(
      'id, public_token, contact_email, shipping_name, subtotal, shipping_fee, discount_amount, total_amount, payment_method',
    )
    .eq('order_number', orderNumber)
    .single();

  if (orderErr || !order) {
    console.error('[notifications] fetchOrderForEmail: order not found', {
      code: orderErr?.code,
    });
    return null;
  }

  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('product_name, quantity, unit_price')
    .eq('order_id', (order as OrderRow).id);

  if (itemsErr || !items) {
    console.error('[notifications] fetchOrderForEmail: items not found', {
      code: itemsErr?.code,
    });
    return null;
  }

  return { order: order as OrderRow, items: items as OrderItemRow[] };
}

/* ─── 공개 API ──────────────────────────────────────────────────────────── */

/**
 * 신규 가입 환영 메일.
 * OAuth callback 의 allow_new 분기에서 호출 (fire-and-forget).
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  try {
    const { subject, html, text } = renderWelcomeEmail({ name });
    /* HIGH-2: 이메일 주소의 @, + 등 IDEMPOTENCY_KEY_PATTERN 미허용 문자를 _ 로 치환 */
    const safeKey = to.toLowerCase().replace(/[^a-z0-9._\-]/g, '_').slice(0, 120);
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey: `welcome:${safeKey}`,
    });
    if (!result.ok) {
      console.error('[notifications] sendWelcomeEmail FAIL', { code: result.error.code });
    }
  } catch (err) {
    console.error('[notifications] sendWelcomeEmail unexpected error', err);
  }
}

/**
 * 결제 승인 완료 주문 확인 메일.
 * confirm/route.ts 성공 후 호출 (fire-and-forget).
 *
 * Session 8-B B-1:
 * - `depositCompleted=true` 면 가상계좌 입금 완료 알림 모드.
 *   템플릿이 "[굳띵즈] 입금이 확인되었습니다" 로 전환되고 idempotencyKey 는
 *   `order-paid:${orderNumber}` 로 분리되어 최초 confirm 메일과 중복되지 않는다.
 *
 * @param orderNumber 주문번호
 * @param virtualAccount confirmOrder 결과의 virtualAccount (가상계좌 시 안내)
 * @param opts.depositCompleted true = 입금 완료 알림(웹훅 경로), false/미지정 = confirm 직후
 */
export async function sendOrderConfirmationEmail(
  orderNumber: string,
  virtualAccount: VirtualAccountInfo,
  opts?: { depositCompleted?: boolean; publicToken?: string },
): Promise<void> {
  try {
    const fetched = await fetchOrderForEmail(orderNumber);
    if (!fetched) return;

    const { order, items } = fetched;
    const depositCompleted = opts?.depositCompleted === true;
    /* Session 11 #3: 호출자(confirm/route.ts) 가 ConfirmResult.publicToken 을
       직접 전달 가능. 없으면 DB 에서 읽은 값으로 폴백 (webhook 경로). */
    const publicToken = opts?.publicToken ?? order.public_token;
    const { subject, html, text } = renderOrderConfirmationEmail({
      orderNumber,
      recipientName: order.shipping_name,
      subtotal: order.subtotal,
      shippingFee: order.shipping_fee,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount,
      method: order.payment_method,
      items: items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      virtualAccount,
      depositCompleted,
      publicToken,
    });

    /* 최초 confirm 메일과 입금완료 메일이 서로 다른 idempotencyKey 를 갖도록 분리 */
    const idempotencyKey = depositCompleted
      ? `order-paid:${orderNumber}`
      : `order-confirm:${orderNumber}`;

    const result = await sendEmail({
      to: order.contact_email,
      subject,
      html,
      text,
      idempotencyKey,
    });
    if (!result.ok) {
      console.error('[notifications] sendOrderConfirmationEmail FAIL', {
        code: result.error.code,
        depositCompleted,
      });
    }
  } catch (err) {
    console.error('[notifications] sendOrderConfirmationEmail unexpected error', err);
  }
}

/**
 * 배송 시작 알림 메일.
 * 어드민이 주문 상태를 'shipping' 으로 전환할 때 호출 (fire-and-forget).
 *
 * @param orderNumber 주문번호
 * @param opts.trackingNumber 송장번호 (선택)
 * @param opts.carrier 택배사명 (선택)
 */
export async function sendShippingNotificationEmail(
  orderNumber: string,
  opts?: { trackingNumber?: string; carrier?: string; publicToken?: string },
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('orders')
      .select('public_token, contact_email, shipping_name')
      .eq('order_number', orderNumber)
      .single();

    if (error || !data) {
      console.error('[notifications] sendShippingNotificationEmail: order not found', {
        code: error?.code,
      });
      return;
    }

    /* MEDIUM-1: as string 캐스트 제거 — 명시적 타입으로 안전하게 처리 */
    const order = data as ShippingOrderRow;

    const { subject, html, text } = renderShippingNotificationEmail({
      orderNumber,
      recipientName: order.shipping_name,
      trackingNumber: opts?.trackingNumber,
      carrier: opts?.carrier,
      publicToken: opts?.publicToken ?? order.public_token,
    });

    const result = await sendEmail({
      to: order.contact_email,
      subject,
      html,
      text,
      idempotencyKey: `shipping:${orderNumber}`,
    });
    if (!result.ok) {
      console.error('[notifications] sendShippingNotificationEmail FAIL', {
        code: result.error.code,
      });
    }
  } catch (err) {
    console.error('[notifications] sendShippingNotificationEmail unexpected error', err);
  }
}
