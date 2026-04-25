/* ══════════════════════════════════════════
   Biz Inquiry 페이지 데이터
   프로토타입 #biz-inquiry-page (L1055~1210, L10047~10070) 그대로 이식.
   - 드롭다운 옵션 3종 (업종 / 월 사용량 / 납품 주기)
   - 관심 제품 체크박스 6종
   - 폼 섹션 라벨 5종
   ══════════════════════════════════════════ */

export type BizDropdownOption = { value: string; label: string };

/** 업종 — 필수 */
export const BIZ_TYPE_OPTIONS: BizDropdownOption[] = [
  { value: 'cafe', label: '카페 / 커피숍' },
  { value: 'bakery', label: '베이커리 / 디저트' },
  { value: 'restaurant', label: '레스토랑 / 다이닝' },
  { value: 'hotel', label: '호텔 / 리조트' },
  { value: 'office', label: '오피스 / 기업 복지' },
  { value: 'coworking', label: '공유오피스' },
  { value: 'distributor', label: '납품 대행 / 유통' },
  { value: 'other', label: '기타' },
];

/** 예상 월 사용량 — 선택 */
export const BIZ_VOLUME_OPTIONS: BizDropdownOption[] = [
  { value: 'under5', label: '5 kg 미만' },
  { value: '5to15', label: '5 – 15 kg' },
  { value: '15to30', label: '15 – 30 kg' },
  { value: '30to50', label: '30 – 50 kg' },
  { value: 'over50', label: '50 kg 이상' },
  { value: 'undecided', label: '미정 (상담 희망)' },
];

/** 희망 납품 주기 — 선택 */
export const BIZ_CYCLE_OPTIONS: BizDropdownOption[] = [
  { value: 'weekly', label: '주 1회' },
  { value: 'monthly', label: '월 1회' },
  { value: 'monthly2', label: '월 2회' },
  { value: 'undecided', label: '미정 (상담 희망)' },
];

/** 관심 제품 — 복수 선택 */
export const BIZ_PRODUCT_OPTIONS: BizDropdownOption[] = [
  { value: 'bean-blend', label: '블렌드 원두' },
  { value: 'bean-single', label: '싱글 오리진' },
  { value: 'decaf', label: '디카페인' },
  { value: 'drip-bag', label: '드립백' },
  { value: 'oem', label: 'OEM / ODM' },
  { value: 'retail', label: '리테일 패키지' },
];
