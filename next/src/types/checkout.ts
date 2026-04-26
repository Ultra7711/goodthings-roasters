/* ══════════════════════════════════════════
   Checkout Types
   체크아웃 폼 데이터
   ══════════════════════════════════════════ */

export type DeliveryMessageOption = {
  value: string;
  label: string;
};

export const DELIVERY_MESSAGES: DeliveryMessageOption[] = [
  { value: '', label: '배송 메시지 선택' },
  { value: 'door', label: '문 앞에 놓아주세요' },
  { value: 'guard', label: '경비실에 맡겨주세요' },
  { value: 'call', label: '배송 전 연락 부탁드립니다' },
  { value: 'custom', label: '직접 입력' },
];

export type CheckoutFormData = {
  email: string;
  firstname: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2: string;
  deliveryMessage: string;
  deliveryCustom: string;
  guestPw: string;
  guestPw2: string;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutFormData | 'agreement', string>>;

export const INITIAL_CHECKOUT: CheckoutFormData = {
  email: '',
  firstname: '',
  phone: '',
  zipcode: '',
  addr1: '',
  addr2: '',
  deliveryMessage: '',
  deliveryCustom: '',
  guestPw: '',
  guestPw2: '',
};
