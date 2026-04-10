/* ══════════════════════════════════════════
   Cafe Menu Types
   프로토타입 CAFE_MENU 배열 구조 기반
   ══════════════════════════════════════════ */

export type MenuTemperature = 'ice-only' | 'hot-only' | 'warm' | 'both' | null;

export type MenuCategory = 'brewing' | 'non-coffee' | 'tea' | 'dessert';

export type MenuStatus = '시그니처' | '시즌' | 'NEW' | '인기' | '품절' | null;

export type MenuItem = {
  /** 고유 ID */
  id: string;
  /** 메뉴명 (한글) */
  name: string;
  /** 카테고리 */
  cat: MenuCategory;
  /** 상태 배지 */
  status: MenuStatus;
  /** 온도 구분 */
  temp: MenuTemperature;
  /** 보조 배지 (status 없을 때) */
  badge2?: string;
  /** 가격 (원) */
  price: number;
  /** 설명 */
  desc?: string;
  /** 이미지 경로 */
  img?: string;
  /** 배경색 */
  bg?: string;
  /** 메뉴 상세 설명 */
  menuDesc: string;
  /** 용량 */
  vol: string;
  /** 칼로리 */
  kcal: number;
  /** 포화지방 */
  satfat: string;
  /** 당류 */
  sugar: string;
  /** 나트륨 */
  sodium: string;
  /** 단백질 */
  protein: string;
  /** 카페인 */
  caffeine: string;
  /** 알레르기 정보 */
  allergen: string;
};

/** 카테고리 필터 탭 아이템 */
export type MenuFilterTab = {
  key: string;
  label: string;
};

/** 카테고리 필터 옵션 */
export const MENU_FILTER_TABS: MenuFilterTab[] = [
  { key: 'all', label: '모든 메뉴' },
  { key: 'signature', label: '시그니처' },
  { key: 'brewing', label: '브루잉/커피' },
  { key: 'tea', label: '티' },
  { key: 'non-coffee', label: '논 커피' },
  { key: 'dessert', label: '디저트' },
];
