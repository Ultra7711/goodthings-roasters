/* ══════════════════════════════════════════
   Cart Types
   ADR-004 Step B: id 를 string UUID 로 통일.
   - 로그인: DB cart_items.id (UUID)
   - 게스트: crypto.randomUUID()
   ══════════════════════════════════════════ */

export type CartItemType = 'normal' | 'subscription';

export type CartItem = {
  /** UUID. 로그인=DB cart_items.id · 게스트=crypto.randomUUID(). */
  id: string;
  /** 상품 slug (URL key) */
  slug: string;
  /** 상품명 */
  name: string;
  /** 표시 가격 (예: "15,000원") */
  price: string;
  /** 파싱된 가격 숫자 */
  priceNum: number;
  /** 수량 (최소 1) */
  qty: number;
  /** 상품 카드 배경색 */
  color: string;
  /** 상품 이미지 URL */
  image: string | null;
  /** 구매 유형 */
  type: CartItemType;
  /** 정기배송 주기 (예: "2주") */
  period: string | null;
  /** 상품 카테고리 */
  category: string;
  /** 용량 (예: "200g") */
  volume: string | null;
};

export type AddToCartPayload = {
  slug: string;
  name: string;
  price: string;
  priceNum?: number;
  qty: number;
  color?: string;
  image?: string | null;
  type?: CartItemType;
  period?: string | null;
  category?: string;
  volume?: string | null;
};
