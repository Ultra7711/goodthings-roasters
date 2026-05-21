import { describe, expect, test } from 'vitest';
import {
  getAllergenDisplayLabel,
  normalizeAllergen,
  STANDARD_ALLERGEN_ORDER,
  syncHighCaffeineMarker,
} from './allergenSort';

describe('normalizeAllergen', () => {
  test('빈 문자열 → 빈 문자열', () => {
    expect(normalizeAllergen('')).toBe('');
  });

  test('공백·콤마만 → 빈 문자열', () => {
    expect(normalizeAllergen(', ,  ,')).toBe('');
  });

  test('단일 항목 (19종 내)', () => {
    expect(normalizeAllergen('우유')).toBe('우유');
  });

  test('단일 항목 (19종 외) — 변경 없음', () => {
    expect(normalizeAllergen('카카오')).toBe('카카오');
  });

  test('19종 내 항목 — 식약처 별표 순으로 정렬', () => {
    expect(normalizeAllergen('대두, 우유')).toBe('우유, 대두');
    expect(normalizeAllergen('밀, 알류, 우유')).toBe('알류, 우유, 밀');
  });

  test('19종 외 항목은 19종 뒤에 가나다순', () => {
    expect(normalizeAllergen('카카오, 우유, 견과류')).toBe('우유, 견과류, 카카오');
  });

  test('19종 외만 — 가나다순', () => {
    expect(normalizeAllergen('카카오, 견과류, 코코넛')).toBe('견과류, 카카오, 코코넛');
  });

  test('별칭 정규화: 계란/달걀/난류 → 알류', () => {
    expect(normalizeAllergen('계란')).toBe('알류');
    expect(normalizeAllergen('달걀')).toBe('알류');
    expect(normalizeAllergen('난류')).toBe('알류');
  });

  test('별칭 정규화: 콩/두유 → 대두', () => {
    expect(normalizeAllergen('콩')).toBe('대두');
    expect(normalizeAllergen('두유')).toBe('대두');
  });

  test('별칭 정규화: 밀크/유제품 → 우유', () => {
    expect(normalizeAllergen('밀크')).toBe('우유');
    expect(normalizeAllergen('유제품')).toBe('우유');
  });

  test('별칭 정규화: 글루텐 → 밀', () => {
    expect(normalizeAllergen('글루텐')).toBe('밀');
  });

  test('정규화 후 중복 제거 — 별칭 + 원본', () => {
    expect(normalizeAllergen('계란, 알류')).toBe('알류');
    expect(normalizeAllergen('콩, 대두, 두유')).toBe('대두');
  });

  test('정규화 후 중복 제거 — 동일 항목 반복', () => {
    expect(normalizeAllergen('우유, 우유, 대두')).toBe('우유, 대두');
  });

  test('공백 포함 입력 — trim 처리', () => {
    expect(normalizeAllergen(' 우유 ,  대두 ')).toBe('우유, 대두');
  });

  test('빈 항목 사이 무시', () => {
    expect(normalizeAllergen('우유, , 대두, ,')).toBe('우유, 대두');
  });

  test('실 카페 메뉴 케이스: 라떼 + 디저트', () => {
    expect(normalizeAllergen('우유, 대두, 밀, 계란, 카카오')).toBe(
      '알류, 우유, 대두, 밀, 카카오',
    );
  });

  test('19종 전체 입력 — 별표 순 그대로', () => {
    /* 입력은 역순 */
    const reversed = [...STANDARD_ALLERGEN_ORDER].reverse().join(', ');
    const expected = STANDARD_ALLERGEN_ORDER.join(', ');
    expect(normalizeAllergen(reversed)).toBe(expected);
  });

  test('19종 + 19종 외 혼합 — 19종 먼저, 19종 외는 가나다', () => {
    expect(normalizeAllergen('잣, 카카오, 우유, 견과류, 호두')).toBe(
      '우유, 호두, 잣, 견과류, 카카오',
    );
  });
});

describe('getAllergenDisplayLabel', () => {
  test('알류 → 알류(계란) 병기', () => {
    expect(getAllergenDisplayLabel('알류')).toBe('알류(계란)');
  });

  test('우유 — 친숙어이므로 단독 유지', () => {
    expect(getAllergenDisplayLabel('우유')).toBe('우유');
  });

  test('대두 — 단독 유지', () => {
    expect(getAllergenDisplayLabel('대두')).toBe('대두');
  });

  test('밀 — 단독 유지', () => {
    expect(getAllergenDisplayLabel('밀')).toBe('밀');
  });

  test('19종 외 항목 (견과류/카카오 등) — 그대로 반환', () => {
    expect(getAllergenDisplayLabel('카카오')).toBe('카카오');
    expect(getAllergenDisplayLabel('견과류')).toBe('견과류');
    expect(getAllergenDisplayLabel('버터')).toBe('버터');
  });
});

describe('syncHighCaffeineMarker', () => {
  test('caffeine >= 150mg + 마커 없음 → 마커 추가', () => {
    expect(syncHighCaffeineMarker('우유', '150mg')).toBe('우유, 고카페인 함유');
  });

  test('caffeine >= 150mg + 마커 이미 있음 → 그대로 (중복 X)', () => {
    expect(syncHighCaffeineMarker('우유, 고카페인 함유', '200mg')).toBe(
      '우유, 고카페인 함유',
    );
  });

  test('caffeine < 150mg + 마커 있음 → 마커 제거', () => {
    expect(syncHighCaffeineMarker('우유, 고카페인 함유', '75mg')).toBe('우유');
  });

  test('caffeine < 150mg + 마커 없음 → 그대로', () => {
    expect(syncHighCaffeineMarker('우유', '75mg')).toBe('우유');
  });

  test('caffeine = 150mg 경계 → 마커 추가 (>= 조건)', () => {
    expect(syncHighCaffeineMarker('', '150mg')).toBe('고카페인 함유');
  });

  test('caffeine = 149mg → 마커 없음', () => {
    expect(syncHighCaffeineMarker('고카페인 함유', '149mg')).toBe('');
  });

  test('빈 allergen + 고카페인 → 마커만', () => {
    expect(syncHighCaffeineMarker('', '200mg')).toBe('고카페인 함유');
  });

  test('정규화 자동 — 별칭 + 정렬도 함께 적용', () => {
    expect(syncHighCaffeineMarker('계란, 우유', '150mg')).toBe(
      '알류, 우유, 고카페인 함유',
    );
  });
});
