import { describe, expect, test } from 'vitest';
import { sortCafeMenu, type CafeMenuBadge2, type CafeMenuItem } from './cafeMenu';

/**
 * sortCafeMenu 정책 (S330):
 *   1. NEW (badge2='NEW') — 카테고리 가로질러 최상단
 *   2. 나머지            — 카테고리 순 (brewing → tea → non-coffee → dessert) + sort_order(input 순서) asc
 *   인기·시그니처(status)는 정렬에 영향 없음 (배지 표시 전용).
 */

function makeItem(
  id: string,
  cat: CafeMenuItem['cat'],
  status: CafeMenuItem['status'] = '',
  badge2: CafeMenuBadge2 = '',
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

  test('NEW(badge2) 는 카테고리 가로질러 최상단 — dessert NEW 가 brewing 앞', () => {
    const items = [
      makeItem('b1', 'brewing'),
      makeItem('d1', 'dessert', '', 'NEW'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['d1', 'b1']);
  });

  test('NEW 그룹 내부도 카테고리 순', () => {
    const items = [
      makeItem('d1', 'dessert', '', 'NEW'),
      makeItem('b1', 'brewing', '', 'NEW'),
      makeItem('n1', 'non-coffee', '', 'NEW'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['b1', 'n1', 'd1']);
  });

  test('시그니처 status 는 정렬에 영향 없음 — non-coffee 시그니처도 brewing 뒤', () => {
    const items = [
      makeItem('n1', 'non-coffee', '시그니처'),
      makeItem('b1', 'brewing', ''),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['b1', 'n1']);
  });

  test('시그니처·인기 status 는 같은 카테고리 내 input 순서 유지 (정렬 무관)', () => {
    const items = [
      makeItem('a', 'brewing', '시그니처'),
      makeItem('b', 'brewing', ''),
      makeItem('c', 'brewing', '인기'),
    ];
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('실제 시나리오 — NEW 그룹(카테고리 순) 먼저, 그다음 나머지(카테고리 순)', () => {
    const items = [
      makeItem('b01', 'brewing', '시그니처'),
      makeItem('b02', 'brewing', '', 'NEW'),
      makeItem('t01', 'tea'),
      makeItem('n01', 'non-coffee'),
      makeItem('d01', 'dessert', '', 'NEW'),
    ];
    /* 1) NEW: b02(brewing), d01(dessert) — 카테고리 순
       2) 나머지: b01(brewing), t01(tea), n01(non-coffee) — 카테고리 순
       시그니처는 정렬 무관. */
    expect(sortCafeMenu(items).map((i) => i.id)).toEqual([
      'b02',
      'd01',
      'b01',
      't01',
      'n01',
    ]);
  });

  test('빈 배열', () => {
    expect(sortCafeMenu([])).toEqual([]);
  });
});
