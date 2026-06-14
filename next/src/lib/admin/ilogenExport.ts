/* ══════════════════════════════════════════════════════════════════════════
   ilogenExport.ts — 로젠택배 ILOGEN 복수건(대량등록) 엑셀 양식 매핑 (S319)

   배경:
   - 운영자가 발송 대기(paid) 주문을 ILOGEN "복수건(대량등록)" 시스템에 업로드해
     운송장을 일괄 발번한다. ILOGEN 엑셀 양식은 8컬럼 고정 순서.
   - ILOGEN 프로그램에서 엑셀 컬럼 알파벳 ↔ 프로그램 매핑을 일치시켜 사용하므로
     컬럼 순서/개수가 계약. 변경 금지.

   설계:
   - 순수 함수 (server-only 아님 · 테스트 용이). DB fetch 는 ordersServer 가 담당.
   - 한 주문 = 한 행 (박스 1개) → 다품목은 summarizeItems 로 요약, 수량 = 1.
   - 수하인전화/휴대폰: 휴대폰 컬럼만 사용 (ILOGEN 둘 중 하나만 필수 · 중복 회피).
   - 수하인주소: 우편번호 접두 포함 (`[12345] 주소`) — ILOGEN 자동 인식 누락 대비.
   - 배송메세지: describeShippingMessage (custom 우선 → code 라벨) 재사용.

   재사용: lib/admin/orders.ts (summarizeItems · describeShippingMessage).
   ══════════════════════════════════════════════════════════════════════════ */

import { summarizeItems, describeShippingMessage } from './orders';

/** ILOGEN 엑셀 헤더 (8컬럼 · 순서 고정 · 프로그램 매핑 계약). */
export const ILOGEN_HEADERS = [
  '주문번호',
  '수하인명',
  '수하인전화',
  '수하인휴대폰',
  '수하인주소',
  '물품명',
  '수량',
  '배송메세지',
] as const;

/** 한 주문 = 한 박스 → 수량 컬럼 고정값. */
const ILOGEN_BOX_QUANTITY = 1;

export type IlogenOrderItem = {
  product_name: string;
  product_volume: string | null;
  quantity: number;
};

export type IlogenOrderInput = {
  orderNumber: string;
  shippingName: string;
  shippingPhone: string | null;
  shippingZipcode: string | null;
  shippingAddr1: string;
  shippingAddr2: string | null;
  shippingMessageCode: string | null;
  shippingMessageCustom: string | null;
  items: IlogenOrderItem[];
};

/** zipcode + addr1 + addr2 → ILOGEN 단일 주소 컬럼. 우편번호 접두 `[12345] `. */
function formatIlogenAddress(
  zipcode: string | null,
  addr1: string,
  addr2: string | null,
): string {
  const base = addr2 && addr2.trim().length > 0 ? `${addr1} ${addr2}` : addr1;
  return zipcode && zipcode.trim().length > 0 ? `[${zipcode}] ${base}` : base;
}

/** 구조화 주문 1건 → ILOGEN 8컬럼 행 (헤더 순서 정합). */
export function toIlogenRow(order: IlogenOrderInput): Array<string | number> {
  const message =
    describeShippingMessage(order.shippingMessageCode, order.shippingMessageCustom)
      ?.text ?? '';

  return [
    order.orderNumber,
    order.shippingName,
    '', // 수하인전화 — 휴대폰만 사용
    order.shippingPhone ?? '',
    formatIlogenAddress(order.shippingZipcode, order.shippingAddr1, order.shippingAddr2),
    summarizeItems(order.items),
    ILOGEN_BOX_QUANTITY,
    message,
  ];
}
