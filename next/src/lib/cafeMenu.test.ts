import { describe, expect, test } from 'vitest';
import { sortCafeMenu, type CafeMenuItem } from './cafeMenu';

/**
 * sortCafeMenu 정책 (S330 단일화):
 *   카테고리 순 (brewing → tea → non-coffee → dessert) + sort_order(input 순서) asc.
 *   NEW(badge2)·인기·시그니처(status)는 정렬에 영향을 주지 않고 배지로만 표시.
 */

function makeItem(
  id: string,
  cat: CafeMenuItem['cat'],
  status: CafeMenuItem['status'] = '',
  badge2 = '',
): CafeMenuItem {
  return {
    id,
    name: id,
    cat,
    status,
    temp: null,
    badge2,
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
  test('카테고리 순 정렬 (brewing → tea → non-coffee → dessert)', () => {
    const items = [
      makeItem('d1', 'dessert'),
      makeItem('n1', 'non-coffee'),
      makeItem('t1', 'tea'),
      makeItem('b1', 'brewing'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['b1', 't1', 'n1', 'd1']);
  });

  test('같은 카테고리 내 input(sort_order) 순서 유지', () => {
    const items = [
      makeItem('a', 'brewing'),
      makeItem('b', 'brewing'),
      makeItem('c', 'brewing'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('NEW(badge2) 는 정렬에 영향 없음 — dessert NEW 도 brewing 뒤', () => {
    const items = [
      makeItem('b1', 'brewing'),
      makeItem('d1', 'dessert', '', 'NEW'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['b1', 'd1']);
  });

  test('시그니처 status 는 정렬에 영향 없음 — non-coffee 시그니처도 brewing 뒤', () => {
    const items = [
      makeItem('n1', 'non-coffee', '시그니처'),
      makeItem('b1', 'brewing', ''),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['b1', 'n1']);
  });

  test('같은 카테고리 내 배지 무관 — input 순서 유지', () => {
    const items = [
      makeItem('a', 'brewing', '시그니처'),
      makeItem('b', 'brewing', '', 'NEW'),
      makeItem('c', 'brewing', '인기'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('실제 시나리오 — 카테고리 그룹 + 그룹 내 순서', () => {
    const items = [
      makeItem('b01', 'brewing', '시그니처'),
      makeItem('b02', 'brewing', '', 'NEW'),
      makeItem('t01', 'tea'),
      makeItem('n01', 'non-coffee'),
      makeItem('d01', 'dessert', '', 'NEW'),
    ];
    /* brewing(b01,b02 input순) → tea(t01) → non-coffee(n01) → dessert(d01).
       시그니처·NEW 는 순서 무관. */
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual([
      'b01',
      'b02',
      't01',
      'n01',
      'd01',
    ]);
  });

  test('빈 배열', () => {
    expect(sortCafeMenu([])).toEqual([]);
  });
});
