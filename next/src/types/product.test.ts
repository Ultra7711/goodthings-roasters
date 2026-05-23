/* ══════════════════════════════════════════════════════════════════════════
   product.test.ts — types/product.ts mapProductRow 단위 테스트 (S211)

   커버리지:
   - mapProductRow: DB row 4 nested → UI Product 매핑 정확성
   - category enum 매핑 (coffee_bean ↔ Coffee Bean)
   - numeric 컬럼 string 응답 안전 변환 (toNumber)
   - 자식 배열 sort_order 정렬
   - popup boolean → optional prop 처리
   - soldOut volume 처리
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  CATEGORY_UI_TO_DB,
  hasImageBlur,
  mapProductRow,
  type ProductWithRelationsRow,
} from './product';

function makeRow(
  overrides: Partial<ProductWithRelationsRow> = {},
): ProductWithRelationsRow {
  return {
    id: 'pid-1',
    slug: 'autumn-night',
    category: 'coffee_bean',
    name: '가을의 밤 Autumn Night',
    display_price: '14,000원',
    color: 'linear-gradient(135deg,#c9a06e,#6b3a20)',
    status: null,
    subscription: true,
    popup: false,
    description: '가을의 밤 블렌드',
    specs: '블렌드: Espresso',
    note_sweet: 3.5,
    note_body: 3.5,
    note_aftertaste: 4,
    note_aroma: 3.5,
    note_acidity: 3,
    note_tags: '견과 | 캐러멜',
    note_tags_en: 'Nutty | Caramel',
    flavor_desc: '낮은 산미와 구수한 단맛',
    note_color: '#A47146',
    roast_stage: 'medium-dark',
    roast_desc: '',
    sort_order: 0,
    is_active: true,
    created_at: '2026-05-11T00:00:00Z',
    updated_at: '2026-05-11T00:00:00Z',
    product_volumes: [],
    product_images: [],
    product_recipes: [],
    ...overrides,
  };
}

describe('CATEGORY_UI_TO_DB', () => {
  it('Coffee Bean → coffee_bean', () => {
    expect(CATEGORY_UI_TO_DB['Coffee Bean']).toBe('coffee_bean');
  });
  it('Drip Bag → drip_bag', () => {
    expect(CATEGORY_UI_TO_DB['Drip Bag']).toBe('drip_bag');
  });
});

describe('mapProductRow — base fields', () => {
  it('스칼라 컬럼 매핑', () => {
    const row = makeRow();
    const product = mapProductRow(row);
    expect(product.slug).toBe('autumn-night');
    expect(product.category).toBe('Coffee Bean');
    expect(product.name).toBe('가을의 밤 Autumn Night');
    expect(product.price).toBe('14,000원');
    expect(product.color).toBe('linear-gradient(135deg,#c9a06e,#6b3a20)');
    expect(product.status).toBeNull();
    expect(product.subscription).toBe(true);
    expect(product.desc).toBe('가을의 밤 블렌드');
    expect(product.specs).toBe('블렌드: Espresso');
    expect(product.noteTags).toBe('견과 | 캐러멜');
    expect(product.noteTagsEn).toBe('Nutty | Caramel');
    expect(product.flavorDesc).toBe('낮은 산미와 구수한 단맛');
    expect(product.noteColor).toBe('#A47146');
    expect(product.roastStage).toBe('medium-dark');
  });

  it('drip_bag → Drip Bag 매핑', () => {
    const row = makeRow({ category: 'drip_bag' });
    expect(mapProductRow(row).category).toBe('Drip Bag');
  });

  it('FlavorNote 객체 매핑 (number 입력)', () => {
    const row = makeRow();
    const note = mapProductRow(row).note;
    expect(note).toEqual({
      sweet: 3.5,
      body: 3.5,
      aftertaste: 4,
      aroma: 3.5,
      acidity: 3,
    });
  });

  it('FlavorNote — Supabase numeric string 응답 안전 변환', () => {
    const row = makeRow({
      // numeric(2,1) 이 string 으로 올 수 있음 — toNumber 가 변환
      note_sweet: '3.5' as unknown as number,
      note_body: '2.0' as unknown as number,
      note_aftertaste: '4.5' as unknown as number,
      note_aroma: '3.0' as unknown as number,
      note_acidity: '2.5' as unknown as number,
    });
    const note = mapProductRow(row).note;
    expect(note.sweet).toBe(3.5);
    expect(note.body).toBe(2);
    expect(note.aftertaste).toBe(4.5);
    expect(note.aroma).toBe(3);
    expect(note.acidity).toBe(2.5);
  });
});

describe('mapProductRow — popup optional', () => {
  it('popup=false → product.popup undefined (생략)', () => {
    const product = mapProductRow(makeRow({ popup: false }));
    expect(product.popup).toBeUndefined();
  });
  it('popup=true → product.popup=true', () => {
    const product = mapProductRow(makeRow({ popup: true }));
    expect(product.popup).toBe(true);
  });
});

describe('mapProductRow — product_volumes', () => {
  it('sort_order 정렬 + 라벨/가격 매핑', () => {
    const row = makeRow({
      product_volumes: [
        { id: 'v3', product_id: 'pid-1', label: '1kg', price: 66000, sold_out: false, sort_order: 2 },
        { id: 'v1', product_id: 'pid-1', label: '200g', price: 14000, sold_out: false, sort_order: 0 },
        { id: 'v2', product_id: 'pid-1', label: '500g', price: 34000, sold_out: false, sort_order: 1 },
      ],
    });
    const volumes = mapProductRow(row).volumes;
    expect(volumes).toEqual([
      { label: '200g', price: 14000 },
      { label: '500g', price: 34000 },
      { label: '1kg', price: 66000 },
    ]);
  });

  it('soldOut=true 만 옵션에 포함', () => {
    const row = makeRow({
      product_volumes: [
        { id: 'v1', product_id: 'pid-1', label: '1개', price: 2000, sold_out: false, sort_order: 0 },
        { id: 'v2', product_id: 'pid-1', label: '10개', price: 20000, sold_out: true, sort_order: 1 },
      ],
    });
    const volumes = mapProductRow(row).volumes;
    expect(volumes[0]).toEqual({ label: '1개', price: 2000 });
    expect(volumes[1]).toEqual({ label: '10개', price: 20000, soldOut: true });
  });
});

describe('mapProductRow — product_images', () => {
  it('sort_order 정렬 + bg_theme → bgTheme', () => {
    const row = makeRow({
      product_images: [
        {
          id: 'i2',
          product_id: 'pid-1',
          src: '/images/products/b.webp',
          bg: '#fff',
          bg_theme: 'light',
          blur_data_url: null,
          width: null,
          height: null,
          sort_order: 1,
          is_active: true,
        },
        {
          id: 'i1',
          product_id: 'pid-1',
          src: '/images/products/a.webp',
          bg: '#000',
          bg_theme: 'dark',
          blur_data_url: 'data:image/png;base64,xxx',
          width: 900,
          height: 900,
          sort_order: 0,
          is_active: true,
        },
      ],
    });
    const images = mapProductRow(row).images;
    expect(images).toEqual([
      {
        bg: '#000',
        bgTheme: 'dark',
        src: '/images/products/a.webp',
        blurDataURL: 'data:image/png;base64,xxx',
        width: 900,
        height: 900,
      },
      {
        bg: '#fff',
        bgTheme: 'light',
        src: '/images/products/b.webp',
        blurDataURL: null,
        width: null,
        height: null,
      },
    ]);
  });
});

describe('mapProductRow — product_recipes', () => {
  it('sort_order 정렬 + 5 칼럼 매핑', () => {
    const row = makeRow({
      product_recipes: [
        { id: 'r2', product_id: 'pid-1', method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g', sort_order: 1 },
        { id: 'r1', product_id: 'pid-1', method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분', water: '120g', sort_order: 0 },
      ],
    });
    const recipe = mapProductRow(row).recipe;
    expect(recipe).toEqual([
      { method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분', water: '120g' },
      { method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g' },
    ]);
  });

  it('Drip Bag — 빈 recipe 배열', () => {
    const row = makeRow({ product_recipes: [] });
    expect(mapProductRow(row).recipe).toEqual([]);
  });
});

describe('hasImageBlur', () => {
  it('all 3 컬럼 채워짐 → true', () => {
    expect(
      hasImageBlur({
        id: 'i1',
        product_id: 'pid-1',
        src: '/x.webp',
        bg: '#fff',
        bg_theme: 'light',
        blur_data_url: 'data:image/png;base64,x',
        width: 900,
        height: 900,
        sort_order: 0,
        is_active: true,
      }),
    ).toBe(true);
  });
  it('blur_data_url null → false', () => {
    expect(
      hasImageBlur({
        id: 'i1',
        product_id: 'pid-1',
        src: '/x.webp',
        bg: '#fff',
        bg_theme: 'light',
        blur_data_url: null,
        width: 900,
        height: 900,
        sort_order: 0,
        is_active: true,
      }),
    ).toBe(false);
  });
});
