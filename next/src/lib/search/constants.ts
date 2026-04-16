/* ══════════════════════════════════════════
   Search — Constants
   프로토타입 SEARCH_SYNONYMS(71 키) → 36개 equivalence class 재구성.
   reverse index 빌드는 matcher.ts 에서 모듈 초기화 시 1회.
   ══════════════════════════════════════════ */

import type { FieldKey } from './types';

/**
 * 동의어 equivalence class.
 * 한 클래스 안의 모든 토큰은 서로 완전 동의어 — reverse index 빌드 시 자동 양방향.
 * 프로토타입 goodthings_v1.0.html L5654–5686 의 편방향/양방향 혼재 매핑을
 * 일관된 양방향으로 통일.
 */
export const SYNONYM_CLASSES: readonly (readonly string[])[] = [
  // 커피 · 원두 · 브루잉
  // '원두' 는 'coffeebean' 클래스에만 배치 — 다중 클래스 교차 참조 방지.
  ['coffee', '커피'],
  ['bean', 'coffeebean', 'coffee bean', '커피빈', '원두'],
  ['brewing', '브루잉'],
  // 에스프레소 음료
  ['latte', '라떼', '라테'],
  ['americano', '아메리카노'],
  ['espresso', '에스프레소', '에스프레쏘'],
  ['카페라떼', '카페라테', '밀크커피'],
  // 축약어 (소비자 구어)
  ['아아', '아이스아메리카노'],
  ['따아', '따뜻한아메리카노'],
  ['사딸라', '딸기라떼'],
  ['자허블', '자몽허니블랙티'],
  // 티 · 논커피
  ['tea', '티'],
  ['blacktea', 'black tea', '블랙티'],
  ['noncoffee', 'non-coffee', '논커피'],
  ['mint', '민트'],
  ['matcha', '말차'],
  // 과일 · 향미
  ['orange', '오렌지'],
  ['grapefruit', '자몽'],
  ['mango', '망고'],
  ['yuzu', '유자'],
  ['milk', '우유', '밀크'],
  // 디저트
  ['dessert', '디저트'],
  ['donut', 'donuts', 'doughnut', '도나쓰', '도너츠', '도나츠', '도너쓰'],
  ['shake', '쉐이크'],
  ['milkshake', '밀크쉐이크'],
  ['cake', '케이크'],
  ['chocolate', 'choco', '초코', '초콜릿', '초콜레이트'],
  // 카테고리 · 상태
  ['dripbag', 'drip bag', '드립백'],
  ['signature', '시그니처'],
  ['season', '시즌', '한정'],
  ['sparkling', '스파클링'],
  ['singleorigin', 'single origin', '싱글오리진'],
  ['blend', '블렌드'],
  ['subscription', '정기배송'],
  // 계절 · 분위기
  ['autumn', '가을'],
  ['night', '밤'],
  ['spring', '봄'],
  ['garden', '정원'],
  // 오타 · 변형
  ['까페', '카페'],
];

/** 카테고리 → 한글 라벨 (프로토타입 CAT_LABEL) */
export const CAT_LABEL: Record<string, string> = {
  brewing: '브루잉',
  'non-coffee': '논커피',
  tea: '티',
  dessert: '디저트',
  'Coffee Bean': '커피빈 원두',
  'Drip Bag': '드립백',
};

/** 된소리·거센소리 초성 → 평음 (NFD 초성 영역 0x1100–0x1112) */
export const CHO_NORMALIZE_MAP: Readonly<Record<string, string>> = {
  '\u1101': '\u1100', // ㄲ → ㄱ
  '\u1104': '\u1103', // ㄸ → ㄷ
  '\u1108': '\u1107', // ㅃ → ㅂ
  '\u110A': '\u1109', // ㅆ → ㅅ
  '\u110D': '\u110C', // ㅉ → ㅈ
  '\u110E': '\u110C', // ㅊ → ㅈ
  '\u110F': '\u1100', // ㅋ → ㄱ
  '\u1110': '\u1103', // ㅌ → ㄷ
  '\u1111': '\u1107', // ㅍ → ㅂ
};

/** 된소리·거센소리 종성 → 평음 (NFD 종성 영역) */
export const JONG_NORMALIZE_MAP: Readonly<Record<string, string>> = {
  '\u11A9': '\u11A8', // ㄲ → ㄱ
  '\u11BB': '\u11BA', // ㅆ → ㅅ
  '\u11BE': '\u11BD', // ㅊ → ㅈ
  '\u11BF': '\u11A8', // ㅋ → ㄱ
  '\u11C0': '\u11AE', // ㅌ → ㄷ
  '\u11C1': '\u11B8', // ㅍ → ㅂ
};

/** 한글 초성 19자 — 완성형 한글 (AC00) 인덱스 계산용 */
export const CHOSUNG_LIST: readonly string[] = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** 완성형 한글 범위 */
export const HANGUL_SYLLABLE_START = 0xac00;
export const HANGUL_SYLLABLE_END = 0xd7a3;
export const HANGUL_CHO_COUNT = 19;
export const HANGUL_JUNG_COUNT = 21;
export const HANGUL_JONG_COUNT = 28;

/**
 * 필드별 가중치 — 매치 스코어의 기본 베이스.
 * 제품명·카테고리 우선, 설명·specs 는 낮게.
 */
export const FIELD_WEIGHTS: Readonly<Record<FieldKey, number>> = {
  name: 100,
  category: 60,
  noteTags: 40,
  specs: 20,
  desc: 15,
  menuDesc: 15,
};

/**
 * 매치 타입별 보너스.
 * exact > prefix > substring > synonym > chosung 순.
 */
export const MATCH_BONUS = {
  exact: 50,
  prefix: 30,
  substring: 10,
  synonym: -5,
  chosung: -20,
} as const;
