/* ══════════════════════════════════════════
   _shared/constants.ts — ProductEditForm 상수 (S260 분리 · S256-A 답습)

   - ROAST_STAGE_OPTIONS / ROAST_STAGE_PLACEHOLDERS — 로스팅 단계 + 단계별 default 설명
   - FLAVOR_AXES — 5축 슬라이더 라벨
   - STATUS_OPTIONS / CATEGORY_OPTIONS — select 옵션
   - DYNAMIC_ROW_* — volumes/recipes 동적 행 gap 토큰
   - DEFAULT_COFFEE_BEAN_RECIPES — 신규 등록 시 추출 레시피 기본 4행
   - TABS / TabId — 3 탭 구성
   ══════════════════════════════════════════ */

/** PDP ProductRoastStage 의 한글 음차 라벨 답습 */
export const ROAST_STAGE_OPTIONS = [
  { value: 'light', label: '라이트' },
  { value: 'medium-light', label: '미디엄 라이트' },
  { value: 'medium', label: '미디엄' },
  { value: 'medium-dark', label: '미디엄 다크' },
  { value: 'dark', label: '다크' },
  { value: 'italian', label: '이탈리안', disabled: true, hint: '국내 시장 희귀 — 사용 안 함' },
] as const;

/** ProductRoastStage.tsx 의 STAGE_DESCRIPTIONS 답습 — 운영자가 빈 값 유지 시 PDP 가 그대로 fallback. */
export const ROAST_STAGE_PLACEHOLDERS: Record<(typeof ROAST_STAGE_OPTIONS)[number]['value'], string> = {
  light:
    '산뜻한 산미와 화사한 향, 산지 고유 특성이 가장 잘 드러나는 단계. 푸어오버와 에어로프레스에 적합합니다.',
  'medium-light':
    '산미와 단맛이 부드럽게 어우러지며 산지 특성이 살아있는 단계. 핸드드립에 잘 어울립니다.',
  medium:
    '캐러멜 단맛과 부드러운 바디가 균형을 이루는 단계. 다양한 추출 방식에 잘 어울립니다.',
  'medium-dark':
    '고소한 토스티드 너트와 깊은 단맛이 어우러지는 단계. 에스프레소 추출에 적합합니다.',
  dark: '묵직한 바디와 카카오의 진한 단맛이 살아나는 단계. 라떼와 카푸치노에 잘 어울립니다.',
  italian:
    '농밀한 풍미와 스모키함이 절정에 이르는 가장 깊은 단계. 진한 에스프레소에 적합합니다.',
};

export const FLAVOR_AXES = [
  { key: 'noteSweet', label: 'Sweet (단맛)' },
  { key: 'noteBody', label: 'Body (바디)' },
  { key: 'noteAftertaste', label: 'Aftertaste (여운)' },
  { key: 'noteAroma', label: 'Aroma (향)' },
  { key: 'noteAcidity', label: 'Acidity (산미)' },
] as const;

export const STATUS_OPTIONS = [
  { value: '', label: '없음' },
  { value: 'NEW', label: 'NEW' },
  { value: '인기 NO.1', label: '인기 NO.1' },
  { value: '인기 NO.2', label: '인기 NO.2' },
  { value: '인기 NO.3', label: '인기 NO.3' },
  { value: '수량 한정', label: '수량 한정' },
  { value: '품절', label: '품절' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'coffee_bean', label: 'Coffee Bean' },
  { value: 'drip_bag', label: 'Drip Bag' },
] as const;

/* 동적 행 (volumes / recipes) grid 간격 토큰 (S231-5).
   admin-design §3 Spacing whitelist 답습. 매직 값 직접 입력 금지 — 본 상수 답습. */
export const DYNAMIC_ROW_LIST_GAP = 'gap-3'; // 행 사이 (카드 안 row ↔ row)
export const DYNAMIC_ROW_CELL_GAP = 'gap-2'; // 행 안 셀 ↔ 셀
export const DYNAMIC_ROW_UNIT_GAP = 'gap-1'; // 인풋 + 화살표 한 몸 (시각 결합)
export const DYNAMIC_ROW_SECTION_BREAK = 'ml-3'; // 그룹 사이 추가 spacing (예: 화살표 → 토글)

/* 신규 등록 시 추출 레시피 기본 4행 — 기존 Coffee Bean 상품 답습 (lib/products.ts).
   운영자가 상품별로 dose/temp/time/water 만 약간 수정해서 등록. */
export const DEFAULT_COFFEE_BEAN_RECIPES = [
  { method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분~1분 30초', water: '120g' },
  { method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g' },
  { method: '모카포트', dose: '12g', temp: '100°C 이상', time: '4분 내외', water: '110g' },
  { method: '드립', dose: '18~20g', temp: '88~92°C', time: '2분 이내 (뜸 30초)', water: '270~360g' },
] as const;

export const TABS = [
  { id: 'basic', label: '기본 정보' },
  { id: 'detail', label: '상세 설명' },
  { id: 'option', label: '용량 / 옵션' },
] as const;

export type TabId = (typeof TABS)[number]['id'];
