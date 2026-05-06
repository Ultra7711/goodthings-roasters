/* ══════════════════════════════════════════════════════════════════════════
   POST /api/orders — 주문 생성 (P2-A-2)

   요청 흐름:
   1) CSRF 가드 (Origin 헤더 검증 — Pass 1 H-2)
   2) Rate Limit (order_create: 10 req / 1 m, IP 기준)
   3) zod 검증 (OrderCreateSchema)
   4) 인증 판단 — getClaims() 결과로 userId 결정
   5) 게스트 조건 검증 — userId == null 이면 contactEmail 을 guestEmail 로 사용
   6) orderService.createOrderFromInput — 가격 재계산 + argon2 + RPC
   7) 201 응답: { data: { id, orderNumber, totalAmount } }

   비즈 원칙:
   - 클라이언트 가격/총액 필드는 받지 않는다. 서버가 권위.
   - 게스트 guest_email 은 contactEmail 로 통일 (폼에 별도 guest email 필드 없음).

   에러 매핑:
   - OrderServiceError('product_not_found' | 'volume_not_found' | 'volume_sold_out')
     → 409 conflict + detail
   - OrderServiceError('subscription_not_allowed')
     → 400 validation_failed + detail
   - 그 외 DB 오류 → 500 server_error
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { parseBody } from '@/lib/api/validate';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { OrderCreateSchema } from '@/lib/schemas/order';
import {
  createOrderFromInput,
  OrderServiceError,
} from '@/lib/services/orderService';
import { findOrdersForUser, type OrderRow, type OrderItemRow } from '@/lib/repositories/orderRepo';
import type { DbOrderStatus } from '@/types/db';
import type { Order, OrderItem, OrderStatus } from '@/types/order';
import { formatDateKST, formatPrice } from '@/lib/utils';

/* ── DB status → UI 한글 상태 매핑 ───────────────────────────────
   S173: cancelled 노출 추가 (운영 명시 취소 케이스).
   pending 은 orderRepo 쿼리 단에서 제외 → 도달 불가. */
function mapDbStatus(status: DbOrderStatus): OrderStatus {
  switch (status) {
    case 'paid':              return '배송준비';
    case 'shipping':          return '배송중';
    case 'delivered':         return '배송완료';
    case 'cancelled':         return '취소됨';
    case 'refund_requested':  return '환불요청';
    case 'refund_processing': return '환불중';
    case 'refunded':          return '환불완료';
    case 'pending':
      throw new Error(`mapDbStatus: 도달 불가 status='${status}' — orderRepo pending 필터 누락`);
  }
}

/* ── OrderRow → Order 변환 ─────────────────────────────────────── */
function toOrder(row: OrderRow): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((it: OrderItemRow) => ({
    name: it.product_name,
    slug: it.product_slug,
    category: it.product_category,
    volume: it.product_volume ?? '',
    qty: it.quantity,
    priceNum: it.unit_price,
    image: {
      src: it.product_image_src ?? '',
      bg: it.product_image_bg ?? '#ECEAE6',
    },
    type: it.item_type,
    period: it.subscription_period ?? null,
  }));

  const first = items[0];
  const name = first?.name ?? '';
  const detail =
    items.length > 1
      ? `${first?.volume ?? ''} 외 ${items.length - 1}건`
      : (first?.volume ?? '');

  const totalAmount = row.total_amount;

  return {
    number: row.order_number,
    date: formatDateKST(row.created_at),
    name,
    detail,
    price: formatPrice(totalAmount),
    priceNum: totalAmount,
    status: mapDbStatus(row.status),
    items,
  };
}

/* ── GET /api/orders — 회원 본인 주문 목록 ─────────────────────── */
export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  try {
    const rows = await findOrdersForUser(20, 0);
    const orders: Order[] = rows.map(toOrder);
    return apiSuccess(orders);
  } catch {
    return apiError('server_error');
  }
}

export async function POST(request: Request): Promise<Response> {
  /* 1) CSRF 가드 — 타 origin 에서의 쿠키 승차 차단 */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit */
  const limited = await checkRateLimit(request, 'order_create');
  if (limited) return limited;

  /* 3) 입력 검증 */
  const parsed = await parseBody(request, OrderCreateSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;

  /* 4) 인증 조회 (null 허용) */
  const claims = await getClaims();
  const userId = claims?.userId ?? null;

  /* 5) 게스트 조건 — contactEmail 을 guestEmail 로 사용 */
  const guestEmail = userId == null ? input.contactEmail : null;

  /* 6) 서비스 호출 */
  try {
    const result = await createOrderFromInput(input, {
      userId,
      guestEmail,
    });

    /* 7) 201 Created */
    return apiSuccess(result, 201);
  } catch (err) {
    /* 도메인 에러 → 4xx 매핑 */
    if (err instanceof OrderServiceError) {
      switch (err.code) {
        case 'product_not_found':
        case 'volume_not_found':
        case 'volume_sold_out':
          return apiError('conflict', { detail: `${err.code}:${err.detail ?? ''}` });
        case 'duplicate_subscription':
          return apiError('conflict', { detail: 'duplicate_subscription', status: 409 });
        case 'subscription_not_allowed':
        case 'guest_pin_required':
        case 'guest_email_required':
          return apiError('validation_failed', {
            detail: err.code,
            status: 400,
          });
        default:
          return apiError('server_error');
      }
    }

    /* DB 오류 등 — 서버 로그에만 스택 남김 */
    console.error('[POST /api/orders] unexpected error', err);
    return apiError('server_error');
  }
}
