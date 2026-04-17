/* ══════════════════════════════════════════
   useProductPurchase
   상품 상세 페이지 구매 옵션 상태 관리
   ══════════════════════════════════════════ */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Product } from '@/lib/products';
import type { CartItemType } from '@/types/cart';
import { useAddCartItem } from '@/hooks/useCart';
import { useCartDrawer } from '@/contexts/CartDrawerContext';
import { formatPrice } from '@/lib/utils';

/** 정기배송 주기 옵션 */
export const SUB_CYCLES = [
  { value: '1', label: '매주 배송' },
  { value: '2', label: '2주마다 배송' },
  { value: '3', label: '3주마다 배송' },
  { value: '4', label: '4주마다 배송' },
] as const;

type OrderType = 'normal' | 'subscription';

export function useProductPurchase(product: Product) {
  const addCart = useAddCartItem();
  const { open: openDrawer } = useCartDrawer();

  const [volumeIdx, setVolumeIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<OrderType>('normal');
  const [cycleValue, setCycleValue] = useState('2');

  const selectedVolume = product.volumes[volumeIdx];
  const basePrice = selectedVolume?.price ?? 0;
  const totalPrice = basePrice * qty;
  const formattedTotal = formatPrice(totalPrice);
  const isSoldOut = product.status === '매진';

  const cycleLabel = useMemo(
    () => SUB_CYCLES.find((c) => c.value === cycleValue)?.label ?? '2주마다 배송',
    [cycleValue],
  );

  const selectVolume = useCallback((idx: number) => {
    setVolumeIdx(idx);
  }, []);

  const incrementQty = useCallback(() => {
    setQty((prev) => prev + 1);
  }, []);

  const decrementQty = useCallback(() => {
    setQty((prev) => Math.max(1, prev - 1));
  }, []);

  const handleAddToCart = useCallback(() => {
    if (isSoldOut) return;

    const isSubscription = orderType === 'subscription' && product.subscription;
    const type: CartItemType = isSubscription ? 'subscription' : 'normal';

    addCart.mutate({
      slug: product.slug,
      name: product.name,
      price: formatPrice(basePrice),
      priceNum: basePrice,
      qty,
      color: product.color,
      image: product.images[0]?.src ?? null,
      type,
      period: isSubscription ? `${cycleValue}주마다` : null,
      category: product.category,
      volume: selectedVolume?.label ?? null,
    });

    /* 프로토타입 addToCart() 동작 일치: 담기 직후 장바구니 드로어 즉시 오픈. */
    openDrawer();
  }, [addCart, openDrawer, product, basePrice, qty, orderType, cycleValue, selectedVolume, isSoldOut]);

  return {
    volumeIdx,
    qty,
    orderType,
    cycleValue,
    cycleLabel,
    selectedVolume,
    basePrice,
    totalPrice,
    formattedTotal,
    isSoldOut,
    selectVolume,
    incrementQty,
    decrementQty,
    setOrderType,
    setCycleValue,
    handleAddToCart,
  } as const;
}
