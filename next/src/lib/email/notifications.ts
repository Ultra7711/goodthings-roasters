/* ══════════════════════════════════════════════════════════════════════════
   email/notifications.ts — 트랜잭셔널 메일 fire-and-forget 래퍼

   원칙 (docs/email-infrastructure.md §10):
   - 이메일 실패는 결제·인증 플로우를 중단하지 않는다.
   - 모든 함수는 실패 시 console.error 만 남기고 resolve 한다.
   - 호출처에서 await 없이 void 로 호출해도 된다.

   DB 접근: getSupabaseAdmin() (service_role, RLS 우회)
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
      'id, contact_email, shipping_name, subtotal, shipping_fee, discount_amount, total_amount, payment_method',
    )
    .eq('order_number', orderNumber)
    .single();

  if (orderErr || !order) {
    console.error(
      `[notifications] fetchOrderForEmail: order not found order_number=${orderNumber}`,
      orderErr?.message,
    );
    return null;
  }

  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('product_name, quantity, unit_price')
    .eq('order_id', (order as OrderRow).id);

  if (itemsErr || !items) {
    console.error(
      `[notifications] fetchOrderForEmail: items not found order_number=${orderNumber}`,
      itemsErr?.message,
    );
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
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey: `welcome:${to.slice(0, 120)}`,
    });
    if (!result.ok) {
      console.error(
        `[notifications] sendWelcomeEmail FAIL code=${result.error.code}`,
      );
    }
  } catch (err) {
    console.error('[notifications] sendWelcomeEmail unexpected error', err);
  }
}

/**
 * 결제 승인 완료 주문 확인 메일.
 * confirm/route.ts 성공 후 호출 (fire-and-forget).
 *
 * @param orderNumber 주문번호
 * @param virtualAccount confirmOrder 결과의 virtualAccount (가상계좌 시 안내)
 */
export async function sendOrderConfirmationEmail(
  orderNumber: string,
  virtualAccount: VirtualAccountInfo,
): Promise<void> {
  try {
    const fetched = await fetchOrderForEmail(orderNumber);
    if (!fetched) return;

    const { order, items } = fetched;
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
    });

    const result = await sendEmail({
      to: order.contact_email,
      subject,
      html,
      text,
      idempotencyKey: `order-confirm:${orderNumber}`,
    });
    if (!result.ok) {
      console.error(
        `[notifications] sendOrderConfirmationEmail FAIL code=${result.error.code} order=${orderNumber}`,
      );
    }
  } catch (err) {
    console.error(
      `[notifications] sendOrderConfirmationEmail unexpected error order=${orderNumber}`,
      err,
    );
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
  opts?: { trackingNumber?: string; carrier?: string },
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data: order, error } = await admin
      .from('orders')
      .select('contact_email, shipping_name')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order) {
      console.error(
        `[notifications] sendShippingNotificationEmail: order not found order_number=${orderNumber}`,
        error?.message,
      );
      return;
    }

    const { subject, html, text } = renderShippingNotificationEmail({
      orderNumber,
      recipientName: order.shipping_name as string,
      trackingNumber: opts?.trackingNumber,
      carrier: opts?.carrier,
    });

    const result = await sendEmail({
      to: order.contact_email as string,
      subject,
      html,
      text,
      idempotencyKey: `shipping:${orderNumber}`,
    });
    if (!result.ok) {
      console.error(
        `[notifications] sendShippingNotificationEmail FAIL code=${result.error.code} order=${orderNumber}`,
      );
    }
  } catch (err) {
    console.error(
      `[notifications] sendShippingNotificationEmail unexpected error order=${orderNumber}`,
      err,
    );
  }
}
