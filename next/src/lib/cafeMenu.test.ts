import { describe, expect, test } from 'vitest';
import { sortCafeMenu, type CafeMenuItem } from './cafeMenu';

/**
 * sortCafeMenu 정책 (S245-P11 정정):
 *   1. NEW
 *   2. popular (좋아요 1~3위 = popularRanks Record)
 *   3. 시그니처
 *   4. 나머지 cat 순 (brewing→tea→non-coffee→dessert)
 *   각 그룹 내부: cat asc + sort_order asc
 *   popular 그룹 내부: rank asc (1 → 2 → 3)
 */

function makeItem(
  id: string,
  cat: CafeMenuItem['cat'],
  status: CafeMenuItem['status'],
): CafeMenuItem {
  return {
    id,
    name: id,
    cat,
    status,
    temp: null,
    badge2: '',
    price: 0,
    desc: '',
    img: '',
    bg: '',
    menuDesc: '',
    vol: '',
    kcal: 0,
    satfat: '',
    sugar: '',
    sodium: '',
    protein: '',
    caffeine: '',
    allergen: '',
  };
}

describe('sortCafeMenu', () => {
  test('NEW 가 다른 status 보다 앞으로', () => {
    const items = [
      makeItem('b01', 'brewing', ''),
      makeItem('d01', 'dessert', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['d01', 'b01']);
  });

  test('NEW > popular > 시그니처 > 나머지 순서', () => {
    const items = [
      makeItem('a1', 'brewing', ''),
      makeItem('a2', 'brewing', '시그니처'),
      makeItem('a3', 'brewing', ''),
      makeItem('a4', 'brewing', 'NEW'),
    ];
    const popularRanks = { a3: 1 as const };
    const sorted = sortCafeMenu(items, popularRanks);
    expect(sorted.map((i) => i.id)).toEqual(['a4', 'a3', 'a2', 'a1']);
  });

  test('popular 그룹 — rank asc (1 → 2 → 3)', () => {
    const items = [
      makeItem('a', 'brewing', ''),
      makeItem('b', 'brewing', ''),
      makeItem('c', 'brewing', ''),
    ];
    /* 입력 순서와 rank 순서 다름 */
    const popularRanks = { a: 3 as const, b: 1 as const, c: 2 as const };
    const sorted = sortCafeMenu(items, popularRanks);
    expect(sorted.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  test('popularRanks 없으면 popular 그룹 적용 안 함', () => {
    const items = [
      makeItem('s1', 'brewing', '시그니처'),
      makeItem('b1', 'brewing', ''),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['s1', 'b1']);
  });

  test('NEW 그룹 — cat 순 (brewing→tea→non-coffee→dessert)', () => {
    const items = [
      makeItem('d1', 'dessert', 'NEW'),
      makeItem('n1', 'non-coffee', 'NEW'),
      makeItem('b1', 'brewing', 'NEW'),
      makeItem('t1', 'tea', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['b1', 't1', 'n1', 'd1']);
  });

  test('일반 메뉴 cat 순 정렬', () => {
    const items = [
      makeItem('d1', 'dessert', ''),
      makeItem('n1', 'non-coffee', ''),
      makeItem('t1', 'tea', ''),
      makeItem('b1', 'brewing', ''),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['b1', 't1', 'n1', 'd1']);
  });

  test('실제 시나리오 — NEW + popular (1,2,3) + 시그니처 + 일반', () => {
    const items = [
      makeItem('s01', 'brewing', '시그니처'),
      makeItem('b01', 'brewing', ''),
      makeItem('b02', 'brewing', ''),
      makeItem('b03', 'tea', ''),
      makeItem('d01', 'dessert', ''),
      makeItem('d09', 'dessert', 'NEW'),
      makeItem('n01', 'non-coffee', 'NEW'),
    ];
    /* 좋아요 1위 = b02, 2위 = b03, 3위 = d01 */
    const popularRanks = { b02: 1 as const, b03: 2 as const, d01: 3 as const };
    const sorted = sortCafeMenu(items, popularRanks);
    /* 1. NEW: n01 (non-coffee), d09 (dessert) — cat 순
       2. popular: b02 (rank 1), b03 (rank 2), d01 (rank 3)
       3. 시그니처: s01
       4. 나머지: b01 */
    expect(sorted.map((i) => i.id)).toEqual([
      'n01', 'd09',
      'b02', 'b03', 'd01',
      's01',
      'b01',
    ]);
  });

  test('빈 배열', () => {
    expect(sortCafeMenu([])).toEqual([]);
  });

  test('stable sort — 동일 우선순위는 input 순서 유지', () => {
    const items = [
      makeItem('a', 'brewing', ''),
      makeItem('b', 'brewing', ''),
      makeItem('c', 'brewing', ''),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('status=시그니처 가 popular 보다 뒤로 (popular 이 우선)', () => {
    const items = [
      makeItem('s01', 'brewing', '시그니처'),
      makeItem('b01', 'brewing', ''),
    ];
    const popularRanks = { b01: 1 as const };
    const sorted = sortCafeMenu(items, popularRanks);
    expect(sorted.map((i) => i.id)).toEqual(['b01', 's01']);
  });
});
