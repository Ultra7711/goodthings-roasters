import { describe, expect, test } from 'vitest';
import { sortCafeMenu, type CafeMenuItem } from './cafeMenu';

/**
 * sortCafeMenu 정책 (S245-P11):
 *   1. NEW → 2. 인기 → 3. 시그니처 → 4. 나머지
 *   각 그룹 내부: cat asc (brewing→tea→non-coffee→dessert) + sort_order asc
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

  test('NEW > 인기 > 시그니처 > 나머지 순서', () => {
    const items = [
      makeItem('a1', 'brewing', ''),
      makeItem('a2', 'brewing', '시그니처'),
      makeItem('a3', 'brewing', '인기'),
      makeItem('a4', 'brewing', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['a4', 'a3', 'a2', 'a1']);
  });

  test('같은 status 그룹 안에서 cat 순 (brewing→tea→non-coffee→dessert)', () => {
    const items = [
      makeItem('d1', 'dessert', 'NEW'),
      makeItem('n1', 'non-coffee', 'NEW'),
      makeItem('b1', 'brewing', 'NEW'),
      makeItem('t1', 'tea', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['b1', 't1', 'n1', 'd1']);
  });

  test('같은 status + 같은 cat 안에서 input 순서 (sort_order asc)', () => {
    const items = [
      makeItem('b1', 'brewing', 'NEW'),
      makeItem('b2', 'brewing', 'NEW'),
      makeItem('b3', 'brewing', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    expect(sorted.map((i) => i.id)).toEqual(['b1', 'b2', 'b3']);
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

  test('실제 시나리오 — NEW 디저트 + 인기 커피 + 시그니처 + 일반', () => {
    const items = [
      makeItem('s01', 'brewing', '시그니처'),
      makeItem('b01', 'brewing', ''),
      makeItem('b02', 'brewing', '인기'),
      makeItem('d01', 'dessert', ''),
      makeItem('d09', 'dessert', 'NEW'),
      makeItem('n01', 'non-coffee', 'NEW'),
    ];
    const sorted = sortCafeMenu(items);
    /* 1. NEW: n01 (non-coffee), d09 (dessert) — cat 순
       2. 인기: b02
       3. 시그니처: s01
       4. 나머지: b01, d01 — cat 순 */
    expect(sorted.map((i) => i.id)).toEqual([
      'n01', 'd09',
      'b02',
      's01',
      'b01', 'd01',
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
});
