/* ══════════════════════════════════════════
   Order Types
   마이페이지 주문 내역 · 주문 완료 공용
   ══════════════════════════════════════════ */

/** 주문 상태 */
export type OrderStatus = '배송중' | '배송완료';

/** 주문 아이템 (주문 내역 카드 내부) */
export type OrderItem = {
  /** 상품명 (한영 병기 원본) */
  name: string;
  /** 상품 slug (상세 이동용) */
  slug: string;
  /** 카테고리 (예: "Coffee Bean") */
  category: string;
  /** 용량 (예: "200g", "5개") */
  volume: string;
  /** 수량 */
  qty: number;
  /** 단가 숫자 */
  priceNum: number;
  /** 상품 이미지 */
  image: {
    src: string;
    /** 이미지 배경색 */
    bg: string;
  };
};

export type Order = {
  /** 주문번호 (GT-YYYYMMDD-NNNNN) */
  number: string;
  /** 주문일자 (YYYY.MM.DD) */
  date: string;
  /** 대표 상품명 (한영 병기 원본) */
  name: string;
  /** 요약 디테일 (예: "200g 외 1건") */
  detail: string;
  /** 총 결제액 (표시용 예: "31,000원") */
  price: string;
  /** 총 결제액 숫자 */
  priceNum: number;
  /** 배송 상태 */
  status: OrderStatus;
  /** 주문 아이템 목록 */
  items: OrderItem[];
};
