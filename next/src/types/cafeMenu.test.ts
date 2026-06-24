/* ══════════════════════════════════════════════════════════════════════════
   cafeMenu.test.ts — types/cafeMenu.ts mapCafeMenuRow 단위 테스트 (S213)

   커버리지:
   - mapCafeMenuRow: DB row → UI CafeMenuItem 매핑 정확성
   - 컬럼명 변환 (description→desc, img_src→img, menu_desc→menuDesc)
   - numeric kcal — string 응답 안전 변환 (toNumber)
   - temp null — 디저트 온도 무관
   - status 빈 문자열 — 배지 미표시
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  mapCafeMenuRow,
  type CafeMenuItemRow,
} from './cafeMenu';

function makeRow(overrides: Partial<CafeMenuItemRow> = {}): CafeMenuItemRow {
  return {
    id: 's01',
    name: '황금오렌지커피',
    cat: 'brewing',
    status: '시그니처',
    temp: 'ice-only',
    badge2: '',
    price: 7000,
    description: '스페셜티 브루잉 커피와 직접 만드는 오렌지 시럽',
    img_src: '/images/cafe-menu/cm_img_gold_orange_coffee.webp',
    bg: '#f5eedc',
    menu_desc: '스페셜티 브루잉 커피와\n오렌지 시럽의 화려한 조화',
    vol: '355ml',
    kcal: 234,
    satfat: '2.9g',
    sugar: '27.5g',
    sodium: '59.7mg',
    protein: '5.0g',
    caffeine: '200.0mg',
    allergen: '우유, 고카페인 함유',
    blur_data_url: null,
    width: null,
    height: null,
    sort_order: 0,
    is_active: true,
    created_at: '2026-05-11T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
    ...overrides,
  };
}

describe('mapCafeMenuRow — 스칼라 컬럼', () => {
  it('id / name / cat / status / temp / badge2 / price / bg 매핑', () => {
    const item = mapCafeMenuRow(makeRow());
    expect(item.id).toBe('s01');
    expect(item.name).toBe('황금오렌지커피');
    expect(item.cat).toBe('brewing');
    expect(item.status).toBe('시그니처');
    expect(item.temp).toBe('ice-only');
    expect(item.badge2).toBe('');
    expect(item.price).toBe(7000);
    expect(item.bg).toBe('#f5eedc');
    expect(item.vol).toBe('355ml');
    expect(item.satfat).toBe('2.9g');
    expect(item.allergen).toBe('우유, 고카페인 함유');
  });
});

describe('mapCafeMenuRow — 컬럼명 변환', () => {
  it('description → desc', () => {
    const item = mapCafeMenuRow(makeRow({ description: '테스트 설명' }));
    expect(item.desc).toBe('테스트 설명');
  });

  it('img_src → img', () => {
    const item = mapCafeMenuRow(makeRow({ img_src: '/images/cafe-menu/test.webp' }));
    expect(item.img).toBe('/images/cafe-menu/test.webp');
  });

  it('menu_desc → menuDesc', () => {
    const item = mapCafeMenuRow(makeRow({ menu_desc: '멀티라인\n설명' }));
    expect(item.menuDesc).toBe('멀티라인\n설명');
  });
});

describe('mapCafeMenuRow — kcal numeric 변환', () => {
  it('number 입력 그대로 반환', () => {
    expect(mapCafeMenuRow(makeRow({ kcal: 234 })).kcal).toBe(234);
  });

  it('string 정수 — toNumber 변환', () => {
    expect(
      mapCafeMenuRow(makeRow({ kcal: '234' as unknown as number })).kcal,
    ).toBe(234);
  });

  it('string 소수 — 소수점 유지', () => {
    expect(
      mapCafeMenuRow(makeRow({ kcal: '294.6' as unknown as number })).kcal,
    ).toBe(294.6);
  });

  it('string "234.0" → 234', () => {
    expect(
      mapCafeMenuRow(makeRow({ kcal: '234.0' as unknown as number })).kcal,
    ).toBe(234);
  });

  it('정수 케이크 kcal', () => {
    expect(mapCafeMenuRow(makeRow({ kcal: 420 })).kcal).toBe(420);
  });
});

describe('mapCafeMenuRow — temp / status 엣지', () => {
  it('temp null — 디저트 온도 무관', () => {
    expect(mapCafeMenuRow(makeRow({ temp: null })).temp).toBeNull();
  });

  it("temp 'both' — 냉온 모두 제공", () => {
    expect(mapCafeMenuRow(makeRow({ temp: 'both' })).temp).toBe('both');
  });

  it("status '' — 배지 미표시", () => {
    expect(mapCafeMenuRow(makeRow({ status: '' })).status).toBe('');
  });

  it("badge2 'NEW' — NEW 마커 매핑 (S330: status 에서 분리)", () => {
    expect(mapCafeMenuRow(makeRow({ badge2: 'NEW' })).badge2).toBe('NEW');
  });

  it("status '시즌 한정'", () => {
    expect(mapCafeMenuRow(makeRow({ status: '시즌 한정' })).status).toBe('시즌 한정');
  });
});

describe('mapCafeMenuRow — 카테고리별 대표 케이스', () => {
  it('brewing — 아메리카노 (b04)', () => {
    const row = makeRow({ id: 'b04', name: '아메리카노', cat: 'brewing', status: '', temp: 'both', kcal: 8 });
    const item = mapCafeMenuRow(row);
    expect(item.cat).toBe('brewing');
    expect(item.kcal).toBe(8);
  });

  it('tea — 로즈얼그레이 (t01)', () => {
    const row = makeRow({ id: 't01', name: '로즈얼그레이', cat: 'tea', status: '', temp: 'both', kcal: 120 });
    expect(mapCafeMenuRow(row).cat).toBe('tea');
  });

  it('non-coffee — 망고먹은오렌지 (n06)', () => {
    const row = makeRow({ id: 'n06', name: '망고먹은오렌지', cat: 'non-coffee', status: '', temp: 'ice-only' });
    expect(mapCafeMenuRow(row).cat).toBe('non-coffee');
  });

  it('dessert — 마틸다 (d01), temp null', () => {
    const row = makeRow({ id: 'd01', name: '마틸다', cat: 'dessert', temp: null, kcal: 420 });
    const item = mapCafeMenuRow(row);
    expect(item.cat).toBe('dessert');
    expect(item.temp).toBeNull();
    expect(item.kcal).toBe(420);
  });
});
