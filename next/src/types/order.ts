/* ══════════════════════════════════════════
   Order Types
   마이페이지 주문 내역 · 주문 완료 공용
   ══════════════════════════════════════════ */

/** 주문 상태 (사용자 노출용 한글 라벨)
 *
 * DB enum 매핑 (S172/S173):
 * - paid              → 배송준비
 * - shipping          → 배송중
 * - delivered         → 배송완료
 * - cancelled         → 취소됨   (S173: 진짜 운영 취소만. abandoned 는 DELETE 처리)
 * - refund_requested  → 환불요청
 * - refund_processing → 환불중
 * - refunded          → 환불완료
 *
 * pending 은 orderRepo 쿼리 단에서 제외되어 도달 불가.
 */
export type OrderStatus =
  | '배송준비'
  | '배송중'
  | '배송완료'
  | '취소됨'
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

/* ══ sessionStorage 'gtr-last-order' 모델 ══
   useCheckoutFlow 가 결제 직전에 저장 → OrderCompletePage 가 read.
   자문 D editorial confirmation 의 5 zone (Hero / Items+합계 / 배송 / Recommend / Email) 데이터 모델.
   discount 정책 (정기배송 할인 5% / 10%) 미확정 — 옵션 필드. 미적용 시 합계 row hide. */
export type StoredOrderItem = {
  name: string;
  slug: string;
  category: string;
  volume: string | null;
  qty: number;
  priceNum: number;
  image: { src: string; bg: string };
  type: string;
  period: string | null;
};

export type StoredOrderShipping = {
  recipientName: string;
  recipientPhone: string;
  zipCode: string;
  /** 도로명/지번 + 상세주소 결합 ("서울 종로구 종로 12, 5층") */
  address: string;
  /** "문 앞에 두고 가주세요" 등. 없으면 undefined. */
  deliveryNote?: string;
};

export type StoredOrderSummary = {
  number: string;
  createdAt: string;
  guestEmail?: string;
  subscriptionCount: number;
  items: StoredOrderItem[];
  /** 상품 금액 합계 (할인·배송비 적용 전) */
  subtotalAmount: number;
  /** 정기배송 할인 (정책 확정 전 옵션 — 미적용 시 row hide) */
  discountAmount?: number;
  shippingFee: number;
  totalAmount: number;
  shipping?: StoredOrderShipping;
};
