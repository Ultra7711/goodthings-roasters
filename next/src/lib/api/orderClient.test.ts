/* ══════════════════════════════════════════════════════════════════════════
   orderClient.test.ts — buildOrderPayload 순수 함수 테스트

   대상: buildOrderPayload (CheckoutFormData + CartItem[] → OrderCreateInput)
   비대상: createOrder (네트워크 — 통합 테스트에서)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { buildOrderPayload, OrderApiError } from './orderClient';
import { OrderCreateSchema } from '@/lib/schemas/order';
import { CHECKOUT_TERMS_VERSION } from '@/lib/constants';
import type { CheckoutFormData } from '@/types/checkout';
import type { CartItem } from '@/types/cart';

/* Pass 1 CODE/H-3: agreements 파라미터 기본값 — 두 항목 모두 체크 */
const AGREED: readonly boolean[] = [true, true];

/* ── 픽스처 ──────────────────────────────────────────────────────────── */

const baseForm: CheckoutFormData = {
  email: '  test@example.com ',
  firstname: ' 홍길동 ',
  phone: '010-1234-5678',
  zipcode: '12345',
  addr1: '서울시 종로구 인사동',
  addr2: '101동 202호',
  deliveryMessage: '',
  deliveryCustom: '',
  guestPw: 'pin1234',
  guestPw2: 'pin1234',
  paymentMethod: 'card',
  bankName: '',
  depositorName: '',
};

const baseItem: CartItem = {
  id: 1,
  slug: 'autumn-night',
  name: '가을의 밤 Autumn Night',
  price: '14,000원',
  priceNum: 14000,
  qty: 2,
  color: '#ECEAE6',
  image: '/images/products/pd_img_autumn_night.webp',
  type: 'normal',
  period: null,
  category: 'Coffee Bean',
  volume: '200g',
};

describe('buildOrderPayload — 기본 필드 매핑', () => {
  it('필수 필드가 zod 스키마 검증을 통과한다', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], false, AGREED);
    const parsed = OrderCreateSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('email/firstname/phone/addr 는 trim 처리된다', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], false, AGREED);
    expect(payload.contactEmail).toBe('test@example.com');
    expect(payload.shipping.name).toBe('홍길동');
    expect(payload.shipping.phone).toBe('010-1234-5678');
  });

  it('termsVersion 은 CHECKOUT_TERMS_VERSION 상수로 세팅된다', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], false, AGREED);
    expect(payload.termsVersion).toBe(CHECKOUT_TERMS_VERSION);
  });

  it('agreement 는 사용자 체크 상태 그대로 true/true 매핑', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], false, AGREED);
    expect(payload.agreement).toEqual({ terms: true, privacy: true });
  });
});

/* Pass 1 CODE/H-3: 하드코딩 제거 — 방어적 invariant 확인 */
describe('buildOrderPayload — agreement 방어 로직', () => {
  it('agreements[0] (terms) 가 false 면 OrderApiError 를 던진다', () => {
    expect(() =>
      buildOrderPayload(baseForm, [baseItem], false, [false, true]),
    ).toThrow(OrderApiError);
  });

  it('agreements[1] (privacy) 가 false 면 OrderApiError 를 던진다', () => {
    expect(() =>
      buildOrderPayload(baseForm, [baseItem], false, [true, false]),
    ).toThrow(OrderApiError);
  });

  it('agreements 배열이 비어있어도 OrderApiError 를 던진다', () => {
    expect(() =>
      buildOrderPayload(baseForm, [baseItem], false, []),
    ).toThrow(OrderApiError);
  });

  it('throw 된 OrderApiError.code 는 agreement_required', () => {
    try {
      buildOrderPayload(baseForm, [baseItem], false, [false, false]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OrderApiError);
      expect((err as OrderApiError).code).toBe('agreement_required');
    }
  });
});

describe('buildOrderPayload — 게스트/회원 분기', () => {
  it('isLoggedIn=false 면 guest.pin 포함', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], false, AGREED);
    expect(payload.guest).toEqual({ pin: 'pin1234' });
  });

  it('isLoggedIn=true 면 guest 는 null', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], true, AGREED);
    expect(payload.guest).toBeNull();
  });
});

describe('buildOrderPayload — 배송 메시지 매핑', () => {
  it('빈 값 → messageCode=null, messageCustom=null', () => {
    const payload = buildOrderPayload(
      { ...baseForm, deliveryMessage: '', deliveryCustom: '' },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.shipping.messageCode).toBeNull();
    expect(payload.shipping.messageCustom).toBeNull();
  });

  it('프리셋 값 → messageCode 설정', () => {
    const payload = buildOrderPayload(
      { ...baseForm, deliveryMessage: '경비실', deliveryCustom: '' },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.shipping.messageCode).toBe('경비실');
    expect(payload.shipping.messageCustom).toBeNull();
  });

  it('"direct" + 내용 → messageCustom 설정', () => {
    const payload = buildOrderPayload(
      {
        ...baseForm,
        deliveryMessage: 'direct',
        deliveryCustom: '  벨 누르지 마세요 ',
      },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.shipping.messageCode).toBeNull();
    expect(payload.shipping.messageCustom).toBe('벨 누르지 마세요');
  });

  it('"direct" + 빈 내용 → 양쪽 모두 null (zod refine 통과)', () => {
    const payload = buildOrderPayload(
      { ...baseForm, deliveryMessage: 'direct', deliveryCustom: '   ' },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.shipping.messageCode).toBeNull();
    expect(payload.shipping.messageCustom).toBeNull();
  });
});

describe('buildOrderPayload — 결제수단 분기', () => {
  it('card 주문 → { method: "card" } 만', () => {
    const payload = buildOrderPayload(
      { ...baseForm, paymentMethod: 'card' },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.payment).toEqual({ method: 'card' });
  });

  it('transfer 주문 → bankName/depositorName 포함', () => {
    const payload = buildOrderPayload(
      {
        ...baseForm,
        paymentMethod: 'transfer',
        bankName: ' 국민은행 ',
        depositorName: ' 홍길동 ',
      },
      [baseItem],
      true,
      AGREED,
    );
    expect(payload.payment).toEqual({
      method: 'transfer',
      bankName: '국민은행',
      depositorName: '홍길동',
    });
  });
});

describe('buildOrderPayload — 아이템 매핑 (가격 필드 제외)', () => {
  it('items 는 slug/volume/quantity/itemType 만 포함 — 가격 필드 없음', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], true, AGREED);
    const item = payload.items[0];
    expect(item.productSlug).toBe('autumn-night');
    expect(item.volume).toBe('200g');
    expect(item.quantity).toBe(2);
    expect(item.itemType).toBe('normal');
    expect(item.subscriptionPeriod).toBeNull();
    /* 가격 필드가 절대 들어가면 안됨 */
    expect(item).not.toHaveProperty('priceNum');
    expect(item).not.toHaveProperty('unitPrice');
    expect(item).not.toHaveProperty('lineTotal');
  });

  it('subscription 아이템 → subscriptionPeriod 유지', () => {
    const subItem: CartItem = {
      ...baseItem,
      type: 'subscription',
      period: '4주',
    };
    const payload = buildOrderPayload(baseForm, [subItem], true, AGREED);
    expect(payload.items[0].itemType).toBe('subscription');
    expect(payload.items[0].subscriptionPeriod).toBe('4주');
  });

  it('normal 인데 period 가 남아있어도 subscriptionPeriod 는 null', () => {
    const dirtyItem: CartItem = {
      ...baseItem,
      type: 'normal',
      period: '4주', // 이전 subscription 선택이 남은 경우
    };
    const payload = buildOrderPayload(baseForm, [dirtyItem], true, AGREED);
    expect(payload.items[0].subscriptionPeriod).toBeNull();
  });

  it('여러 아이템 유지 + 순서 보존', () => {
    const item2: CartItem = { ...baseItem, id: 2, slug: 'refreshing-afternoon', qty: 1 };
    const payload = buildOrderPayload(baseForm, [baseItem, item2], true, AGREED);
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].productSlug).toBe('autumn-night');
    expect(payload.items[1].productSlug).toBe('refreshing-afternoon');
  });
});

describe('buildOrderPayload — 절대 금액 필드를 포함하지 않는다 (서버 권위)', () => {
  it('최상위 레벨에 subtotal/shippingFee/totalAmount 가 없다', () => {
    const payload = buildOrderPayload(baseForm, [baseItem], true, AGREED);
    expect(payload).not.toHaveProperty('subtotal');
    expect(payload).not.toHaveProperty('shippingFee');
    expect(payload).not.toHaveProperty('totalAmount');
    expect(payload).not.toHaveProperty('discountAmount');
  });
});
