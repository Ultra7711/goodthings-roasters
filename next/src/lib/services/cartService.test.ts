/* ══════════════════════════════════════════════════════════════════════════
   cartService.test.ts — 카트 서비스 단위 테스트 (Session 12)

   커버리지:
   - buildUpsertParams — PRODUCTS 기준 단가 스냅샷, 정기배송 검증
   - addCartItem       — buildUpsertParams + upsertCartItem 호출 경로
   - mergeGuestCart    — 성공/스킵 카운트, 도메인 에러 스킵 여부

   Mock: cartRepo.upsertCartItem (DB 없이 테스트)
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/repositories/cartRepo', () => ({
  upsertCartItem: vi.fn(),
  bulkMergeCartItems: vi.fn(),
}));

import {
  addCartItem,
  buildUpsertParams,
  mergeGuestCart,
} from './cartService';
import {
  upsertCartItem,
  bulkMergeCartItems,
} from '@/lib/repositories/cartRepo';
import { OrderServiceError } from './orderService';
import { PRODUCTS } from '@/lib/products';

const coffeeBean = PRODUCTS.find((p) => p.category === 'Coffee Bean')!;
const dripBag = PRODUCTS.find((p) => p.category === 'Drip Bag')!;
const USER_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.mocked(upsertCartItem).mockReset();
  vi.mocked(bulkMergeCartItems).mockReset();
  vi.mocked(upsertCartItem).mockImplementation(async (params) => ({
    id: 'row-id',
    user_id: params.userId,
    product_slug: params.productSlug,
    product_volume: params.productVolume,
    quantity: params.quantity,
    unit_price_snapshot: params.unitPriceSnapshot,
    item_type: params.itemType,
    subscription_period: params.subscriptionPeriod,
    created_at: '2026-04-17T00:00:00.000Z',
    updated_at: '2026-04-17T00:00:00.000Z',
  }));
  vi.mocked(bulkMergeCartItems).mockImplementation(
    async (_userId, items) => items.length,
  );
});

describe('buildUpsertParams — 입력 검증 및 단가 스냅샷', () => {
  it('normal 아이템을 PRODUCTS.volumes[].price 기준으로 단가 스냅샷 설정', () => {
    const v0 = coffeeBean.volumes[0];
    const params = buildUpsertParams(USER_ID, {
      productSlug: coffeeBean.slug,
      volume: v0.label,
      quantity: 2,
      itemType: 'normal',
      subscriptionPeriod: null,
    });
    expect(params.unitPriceSnapshot).toBe(v0.price);
    expect(params.productSlug).toBe(coffeeBean.slug);
    expect(params.productVolume).toBe(v0.label);
    expect(params.subscriptionPeriod).toBeNull();
    expect(params.userId).toBe(USER_ID);
  });

  it('subscription 아이템은 product.subscription=true 인 상품만 허용', () => {
    const v0 = dripBag.volumes[0];
    expect(() =>
      buildUpsertParams(USER_ID, {
        productSlug: dripBag.slug,
        volume: v0.label,
        quantity: 1,
        itemType: 'subscription',
        subscriptionPeriod: '2주',
      }),
    ).toThrow(OrderServiceError);
  });

  it('존재하지 않는 slug 는 product_not_found 에러', () => {
    try {
      buildUpsertParams(USER_ID, {
        productSlug: 'nope',
        volume: '200g',
        quantity: 1,
        itemType: 'normal',
        subscriptionPeriod: null,
      });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('product_not_found');
    }
  });

  it('존재하지 않는 volume 은 volume_not_found 에러', () => {
    try {
      buildUpsertParams(USER_ID, {
        productSlug: coffeeBean.slug,
        volume: '9999kg',
        quantity: 1,
        itemType: 'normal',
        subscriptionPeriod: null,
      });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderServiceError);
      expect((e as OrderServiceError).code).toBe('volume_not_found');
    }
  });
});

describe('addCartItem — 단일 담기', () => {
  it('빌드된 파라미터로 repo.upsertCartItem 호출', async () => {
    const v0 = coffeeBean.volumes[0];
    const row = await addCartItem(USER_ID, {
      productSlug: coffeeBean.slug,
      volume: v0.label,
      quantity: 3,
      itemType: 'normal',
      subscriptionPeriod: null,
    });
    expect(upsertCartItem).toHaveBeenCalledTimes(1);
    expect(row.quantity).toBe(3);
    expect(row.unit_price_snapshot).toBe(v0.price);
  });
});

describe('mergeGuestCart — 로그인 직후 localStorage 흡수', () => {
  it('모두 유효 → merged=N, skipped=0', async () => {
    const v0 = coffeeBean.volumes[0];
    const v1 = coffeeBean.volumes[1] ?? v0;

    const result = await mergeGuestCart(USER_ID, {
      items: [
        {
          productSlug: coffeeBean.slug,
          volume: v0.label,
          quantity: 1,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
        {
          productSlug: coffeeBean.slug,
          volume: v1.label,
          quantity: 2,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
      ],
    });
    expect(result.merged).toBe(2);
    expect(result.skipped).toBe(0);
    expect(bulkMergeCartItems).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bulkMergeCartItems).mock.calls[0][1]).toHaveLength(2);
  });

  it('도메인 에러(잘못된 slug) 는 스킵, 나머지 진행', async () => {
    const v0 = coffeeBean.volumes[0];
    const result = await mergeGuestCart(USER_ID, {
      items: [
        {
          productSlug: 'nope',
          volume: '200g',
          quantity: 1,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
        {
          productSlug: coffeeBean.slug,
          volume: v0.label,
          quantity: 1,
          itemType: 'normal',
          subscriptionPeriod: null,
        },
      ],
    });
    expect(result.merged).toBe(1);
    expect(result.skipped).toBe(1);
    expect(bulkMergeCartItems).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bulkMergeCartItems).mock.calls[0][1]).toHaveLength(1);
  });

  it('DB 오류(비 도메인 에러) 는 상위로 전파', async () => {
    vi.mocked(bulkMergeCartItems).mockRejectedValueOnce(new Error('db down'));
    const v0 = coffeeBean.volumes[0];
    await expect(
      mergeGuestCart(USER_ID, {
        items: [
          {
            productSlug: coffeeBean.slug,
            volume: v0.label,
            quantity: 1,
            itemType: 'normal',
            subscriptionPeriod: null,
          },
        ],
      }),
    ).rejects.toThrow('db down');
  });
});
