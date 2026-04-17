/* ══════════════════════════════════════════
   Mock MyPage Data
   마이페이지 더미 데이터 (주문 · 정기배송 · 주소)
   Phase 2-F에서 Supabase fetch 함수로 교체 예정
   ══════════════════════════════════════════ */

import type { Order } from '@/types/order';
import type { Subscription } from '@/types/subscription';
import type { UserAddress } from '@/types/address';

/** 더미 주문 내역 */
export const MOCK_ORDERS: Order[] = [
  {
    number: 'GT-20260328-00051',
    date: '2026.03.28',
    name: '가을의 밤 Autumn Night',
    detail: '200g 외 1건',
    price: '31,000원',
    priceNum: 31000,
    status: '배송완료',
    items: [
      {
        name: '가을의 밤 Autumn Night',
        slug: 'autumn-night',
        category: 'Coffee Bean',
        volume: '200g',
        qty: 2,
        priceNum: 14000,
        image: {
          src: '/images/products/pd_img_autumn_night.webp',
          bg: '#ECEAE6',
        },
      },
      {
        name: '과테말라 와이칸 Guatemala Waykan',
        slug: 'guatemala-waykan',
        category: 'Drip Bag',
        volume: '5개',
        qty: 1,
        priceNum: 10000,
        image: {
          src: '/images/products/pd_img_quatemala_waykan.webp',
          bg: '#ECEAE6',
        },
      },
    ],
  },
  {
    number: 'GT-20260325-00048',
    date: '2026.03.25',
    name: '봄의 정원 Spring Garden',
    detail: '500g',
    price: '34,000원',
    priceNum: 34000,
    status: '배송중',
    items: [
      {
        name: '산뜻한 오후 Refreshing Afternoon',
        slug: 'refreshing-afternoon',
        category: 'Coffee Bean',
        volume: '500g',
        qty: 1,
        priceNum: 34000,
        image: {
          src: '/images/products/pd_img_refreshing_afternoon.webp',
          bg: '#ECEAE6',
        },
      },
    ],
  },
  {
    number: 'GT-20260320-00042',
    date: '2026.03.20',
    name: '가을의 밤 Autumn Night',
    detail: '1kg',
    price: '66,000원',
    priceNum: 66000,
    status: '배송완료',
    items: [
      {
        name: '가을의 밤 Autumn Night',
        slug: 'autumn-night',
        category: 'Coffee Bean',
        volume: '1kg',
        qty: 1,
        priceNum: 66000,
        image: {
          src: '/images/products/pd_img_autumn_night.webp',
          bg: '#ECEAE6',
        },
      },
    ],
  },
];

/** 더미 정기배송 내역 */
export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-1',
    slug: 'autumn-night',
    name: '가을의 밤 Autumn Night',
    volume: '200g',
    cycle: '2주',
    nextDate: '2026.04.15',
  },
  {
    id: 'sub-2',
    slug: 'spring-garden',
    name: '봄의 정원 Spring Garden',
    volume: '500g',
    cycle: '2주',
    nextDate: '2026.04.20',
  },
  {
    id: 'sub-3',
    slug: 'ethiopia-yirgacheffe',
    name: '에티오피아 예가체프 코체레',
    volume: '200g',
    cycle: '4주',
    nextDate: '2026.04.10',
  },
];

/** 더미 기본 주소 — 초기 상태는 null (등록된 주소 없음) */
export const MOCK_DEFAULT_ADDRESS: UserAddress | null = null;
