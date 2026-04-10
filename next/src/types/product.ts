/* ══════════════════════════════════════════
   Product Types
   프로토타입 PRODUCTS 배열 구조 기반
   ══════════════════════════════════════════ */

export type ProductImage = {
  /** 배경색 */
  bg: string;
  /** 헤더 테마 힌트 */
  bgTheme: 'light' | 'dark';
  /** 이미지 경로 */
  src: string;
};

export type ProductVolume = {
  /** 용량 라벨 (예: "200g") */
  label: string;
  /** 해당 용량의 가격 */
  price: number;
};

export type ProductStatus =
  | 'NEW'
  | '인기 NO.1'
  | '인기 NO.2'
  | '인기 NO.3'
  | '수량 한정'
  | '매진'
  | null;

/** 5축 플레이버 프로파일 (0–5) */
export type FlavorNote = {
  sweet: number;
  body: number;
  aftertaste: number;
  aroma: number;
  acidity: number;
};

/** 로스팅 단계 */
export type RoastStage =
  | 'light'
  | 'medium-light'
  | 'medium'
  | 'medium-dark'
  | 'dark';

/** Coffee Bean 추출 레시피 */
export type RecipeMethod = {
  method: string;
  dose: string;
  temp: string;
  time: string;
  water: string;
};

/** Drip Bag 공통 레시피 */
export type DripBagRecipe = {
  step1: string;
  step2: string;
  step3: string;
  tip: string;
};

export type Product = {
  /** 상품 카테고리 */
  category: string;
  /** 상품명 (한글 + 영문) */
  name: string;
  /** 표시 가격 (예: "14,000원") */
  price: string;
  /** 용량별 가격 옵션 */
  volumes: ProductVolume[];
  /** 카드 배경 그라데이션 */
  color: string;
  /** 상품 상태 배지 */
  status: ProductStatus;
  /** URL 슬러그 */
  slug: string;
  /** 정기배송 가능 여부 */
  subscription: boolean;
  /** 상품 이미지 배열 */
  images: ProductImage[];
  /** 상품 설명 */
  desc: string;
  /** 상세 스펙 (· 구분) */
  specs?: string;
  /** 플레이버 노트 5축 데이터 */
  note?: FlavorNote;
  /** 노트 태그 문자열 (파이프 구분, 예: "Nutty | Caramel") */
  noteTags?: string;
  /** 노트 강조 색상 (hex) */
  noteColor?: string;
  /** 로스팅 단계 */
  roastStage?: RoastStage;
  /** Coffee Bean 추출 레시피 */
  recipe?: RecipeMethod[];
};
