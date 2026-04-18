/* ══════════════════════════════════════════════════════════════════════════
   orderService.test.ts — 순수 계산 유틸 단위 테스트

   대상: buildRpcItem, recomputeItems, calcShippingFee, resolveProduct, resolveVolume
   비대상: createOrderFromInput (DB RPC 의존 — 통합 테스트에서 처리)
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  buildRpcItem,
  calcShippingFee,
  recomputeItems,
  resolveProduct,
  resolveVolume,
  OrderServiceError,
} from './orderService';
import { PRODUCTS } from '@/lib/products';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '@/hooks/useCart';

/* ── 픽스처 ──────────────────────────────────────────────────────────── */

/** PRODUCTS 의 첫 번째 커피빈 (정기배송 가능) */
const coffeeBean = PRODUCTS.find((p) => p.category === 'Coffee Bean')!;
/** PRODUCTS 의 첫 번째 드립백 (정기배송 불가) */
const dripBag = PRODUCTS.find((p) => p.category === 'Drip Bag')!;

describe('resolveProduct — slug 로 카탈로그 탐색', () => {
  it('존재하는 slug 를 Product 로 반환한다', () => {
    const p = resolveProduct(coffeeBean.slug);
    expect(p.slug).toBe(coffeeBean.slug);
    expect(p.name).toBe(coffeeBean.name);
  });

  it('존재하지 않는 slug 는 product_not_found 에러', () => {
    expect(() => resolveProduct('non-existent-slug')).toThrow(OrderServiceError);
    try {
      resolveProduct('non-existent-slug');
    } catch (e) {
      expect((e as OrderServiceError).code).toBe('product_not_found');
    }
  });
});

describe('resolveVolume — volume(label) 조회', () => {
  it('존재하는 label 을 ProductVolume 으로 반환한다', () => {
    const first = coffeeBean.volumes[0];
    const v = resolveVolume(coffeeBean, first.label);
    expect(v.label).toBe(first.label);
    expect(v.price).toBe(first.price);
  });

  it('존재하지 않는 label 은 volume_not_found 에러', () => {
    try {
      resolveVolume(coffeeBean, '999kg');
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('volume_not_found');
    }
  });

  it('soldOut volume 은 volume_sold_out 에러', () => {
    const mockProduct = {
      ...coffeeBean,
      volumes: [{ label: '테스트', price: 1000, soldOut: true }],
    };
    try {
      resolveVolume(mockProduct, '테스트');
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('volume_sold_out');
    }
  });
});

describe('calcShippingFee — 배송비 규칙 (cartCalc 와 동일)', () => {
  it('소계 0 → 배송비 0', () => {
    expect(calcShippingFee(0)).toBe(0);
  });

  it('FREE_SHIPPING_THRESHOLD 미만 → SHIPPING_FEE', () => {
    expect(calcShippingFee(1000)).toBe(SHIPPING_FEE);
    expect(calcShippingFee(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_FEE);
  });

  it('FREE_SHIPPING_THRESHOLD 이상 → 0', () => {
    expect(calcShippingFee(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(calcShippingFee(FREE_SHIPPING_THRESHOLD + 100)).toBe(0);
  });
});

describe('buildRpcItem — 서버 권위 단가 재계산', () => {
  const firstVolume = coffeeBean.volumes[0];

  it('unit_price 는 PRODUCTS.volumes[].price 로 강제된다 (클라 값 무시)', () => {
    const item = buildRpcItem({
      productSlug: coffeeBean.slug,
      volume: firstVolume.label,
      quantity: 3,
      itemType: 'normal',
      subscriptionPeriod: null,
    });
    expect(item.unit_price).toBe(firstVolume.price);
    expect(item.original_unit_price).toBe(firstVolume.price);
    expect(item.line_total).toBe(firstVolume.price * 3);
  });

  it('스냅샷 필드: product_name · product_category · image 가 PRODUCTS 에서 복사된다', () => {
    const item = buildRpcItem({
      productSlug: coffeeBean.slug,
      volume: firstVolume.label,
      quantity: 1,
      itemType: 'normal',
      subscriptionPeriod: null,
    });
    expect(item.product_name).toBe(coffeeBean.name);
    expect(item.product_category).toBe(coffeeBean.category);
    expect(item.product_slug).toBe(coffeeBean.slug);
    expect(item.product_volume).toBe(firstVolume.label);
    expect(item.product_image_src).toBe(coffeeBean.images[0].src);
    expect(item.product_image_bg).toBe(coffeeBean.images[0].bg);
  });

  it('normal 주문: subscription_period 는 null', () => {
    const item = buildRpcItem({
      productSlug: coffeeBean.slug,
      volume: firstVolume.label,
      quantity: 1,
      itemType: 'normal',
      subscriptionPeriod: null,
    });
    expect(item.item_type).toBe('normal');
    expect(item.subscription_period).toBeNull();
  });

  it('subscription 주문: subscription_period 가 유지된다', () => {
    const item = buildRpcItem({
      productSlug: coffeeBean.slug,
      volume: firstVolume.label,
      quantity: 1,
      itemType: 'subscription',
      subscriptionPeriod: '4주',
    });
    expect(item.item_type).toBe('subscription');
    expect(item.subscription_period).toBe('4주');
  });

  it('정기배송 불가 상품을 subscription 으로 주문 시 에러', () => {
    const firstDripVolume = dripBag.volumes[0];
    try {
      buildRpcItem({
        productSlug: dripBag.slug,
        volume: firstDripVolume.label,
        quantity: 1,
        itemType: 'subscription',
        subscriptionPeriod: '2주',
      });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('subscription_not_allowed');
    }
  });
});

describe('recomputeItems — 배열 + 소계', () => {
  it('빈 배열 → subtotal 0', () => {
    const { rpcItems, subtotal } = recomputeItems([]);
    expect(rpcItems).toEqual([]);
    expect(subtotal).toBe(0);
  });

  it('여러 아이템의 line_total 합이 subtotal 과 일치한다', () => {
    const v0 = coffeeBean.volumes[0];
    const v1 = coffeeBean.volumes[1] ?? v0;

    const { rpcItems, subtotal } = recomputeItems([
      {
        productSlug: coffeeBean.slug,
        volume: v0.label,
        quantity: 2,
        itemType: 'normal',
        subscriptionPeriod: null,
      },
      {
        productSlug: coffeeBean.slug,
        volume: v1.label,
        quantity: 1,
        itemType: 'normal',
        subscriptionPeriod: null,
      },
    ]);

    expect(rpcItems).toHaveLength(2);
    const expected = v0.price * 2 + v1.price * 1;
    expect(subtotal).toBe(expected);
    expect(rpcItems[0].line_total + rpcItems[1].line_total).toBe(subtotal);
  });

  it('알 수 없는 slug 가 포함되면 product_not_found 에러', () => {
    try {
      recomputeItems([
        {
          productSlug: 'bogus-slug',
          volume: '200g',
          quantity: 1,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
      ]);
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('product_not_found');
    }
  });
});

describe('통합: 소계 + 배송비 규칙 일관성', () => {
  it('소계 >= FREE_SHIPPING_THRESHOLD 이면 배송비 0 (무료)', () => {
    /* 커피빈 500g = 34,000원 (일반적으로 threshold 30,000 초과) */
    const v = coffeeBean.volumes.find((vol) => vol.price >= FREE_SHIPPING_THRESHOLD);
    if (!v) return; // 테스트 스킵: 데이터 전제 불충족
    const { subtotal } = recomputeItems([
      {
        productSlug: coffeeBean.slug,
        volume: v.label,
        quantity: 1,
        itemType: 'normal',
        subscriptionPeriod: null,
      },
    ]);
    expect(subtotal).toBe(v.price);
    expect(calcShippingFee(subtotal)).toBe(0);
  });

  it('소계 < FREE_SHIPPING_THRESHOLD 이면 배송비 SHIPPING_FEE', () => {
    const v = coffeeBean.volumes.find((vol) => vol.price < FREE_SHIPPING_THRESHOLD);
    if (!v) return;
    const { subtotal } = recomputeItems([
      {
        productSlug: coffeeBean.slug,
        volume: v.label,
        quantity: 1,
        itemType: 'normal',
        subscriptionPeriod: null,
      },
    ]);
    expect(calcShippingFee(subtotal)).toBe(SHIPPING_FEE);
  });
});
