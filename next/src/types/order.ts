/* ══════════════════════════════════════════
   Order Types
   마이페이지 주문 내역 · 주문 완료 공용
   ══════════════════════════════════════════ */

/** 주문 상태 (사용자 노출용 한글 라벨)
 *
 * DB enum 매핑 (S172):
 * - paid              → 배송준비
 * - shipping          → 배송중
 * - delivered         → 배송완료
 * - refund_requested  → 환불요청
 * - refund_processing → 환불중
 * - refunded          → 환불완료
 *
 * pending/cancelled 은 orderRepo 쿼리 단에서 제외되어 도달 불가.
 */
export type OrderStatus =
  | '배송준비'
  | '배송중'
  | '배송완료'
  | '환불요청'
  | '환불중'
  | '환불완료';

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
  /** 주문 유형 (예: "subscription") — 정기배송 식별용 */
  type?: string;
  /** 정기배송 주기 (예: "4주") — type === 'subscription' 일 때 유효 */
  period?: string | null;
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
