/* ══════════════════════════════════════════
   Address Types
   배송지 주소 (마이페이지 · 체크아웃 공용)
   ══════════════════════════════════════════ */

export type UserAddress = {
  /** 수령인 이름 */
  name: string;
  /** 전화번호 (01X-XXXX-XXXX) */
  phone: string;
  /** 우편번호 (5자리) */
  zipcode: string;
  /** 기본 주소 */
  addr1: string;
  /** 상세 주소 */
  addr2: string;
};

export const EMPTY_ADDRESS: UserAddress = {
  name: '',
  phone: '',
  zipcode: '',
  addr1: '',
  addr2: '',
};
