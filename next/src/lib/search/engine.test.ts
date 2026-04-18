import { describe, expect, it } from 'vitest';
import { buildSearchIndex, search } from './engine';
import type { Product } from '@/lib/products';
import type { CafeMenuItem } from '@/lib/cafeMenu';

/* ── 테스트 픽스처 ───────────────────────────────── */

const mkProduct = (overrides: Partial<Product>): Product => ({
  category: 'Coffee Bean',
  name: '기본상품',
  price: '10,000원',
  volumes: [],
  color: '',
  status: null,
  slug: 'default',
  subscription: true,
  images: [],
  desc: '',
  specs: '',
  note: { sweet: 0, body: 0, aftertaste: 0, aroma: 0, acidity: 0 },
  noteTags: '',
  noteColor: '',
  roastStage: 'medium',
  recipe: [],
  ...overrides,
});

const mkCafe = (overrides: Partial<CafeMenuItem>): CafeMenuItem => ({
  id: 'id',
  name: '기본메뉴',
  cat: 'brewing',
  status: '',
  temp: 'both',
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
  ...overrides,
});

const PRODUCTS: Product[] = [
  mkProduct({ name: '가을의 밤 Autumn Night', slug: 'autumn-night', desc: '풍미 가득한 에스프레소 블렌드', noteTags: 'Nutty Caramel' }),
  mkProduct({ name: '산뜻한 오후 Refreshing Afternoon', slug: 'refreshing-afternoon', desc: '산미 있는 싱글오리진', noteTags: 'Fruit Stonefruit' }),
  mkProduct({ name: '에티오피아 부쿠 후루파', slug: 'ethiopia-buku-hurupa', category: 'Drip Bag' }),
  mkProduct({ name: '자몽 허니 블랙티', slug: 'grapefruit-tea', desc: '자몽향 가득' }),
];

const CAFE: CafeMenuItem[] = [
  mkCafe({ id: 'iced-americano', name: '아이스 아메리카노', menuDesc: '에스프레소 + 물' }),
  mkCafe({ id: 'matcha-latte', name: '말차 라떼', cat: 'non-coffee' }),
  mkCafe({ id: 'earl-grey', name: '얼그레이', cat: 'tea' }),
];

/* ── 테스트 ──────────────────────────────────── */

describe('buildSearchIndex', () => {
  it('products + cafe menu 를 통합 인덱스로 빌드한다', () => {
    const idx = buildSearchIndex(PRODUCTS, CAFE);
    expect(idx.length).toBe(PRODUCTS.length + CAFE.length);
  });

  it('product 는 kind=product, cafe 는 kind=cafe 로 분류', () => {
    const idx = buildSearchIndex(PRODUCTS, CAFE);
    const products = idx.filter((e) => e.kind === 'product');
    const cafes = idx.filter((e) => e.kind === 'cafe');
    expect(products.length).toBe(PRODUCTS.length);
    expect(cafes.length).toBe(CAFE.length);
  });

  it('각 엔트리는 pre-computed fields 를 가진다', () => {
    const idx = buildSearchIndex(PRODUCTS, CAFE);
    for (const e of idx) {
      expect(e.fields.length).toBeGreaterThan(0);
      for (const f of e.fields) {
        expect(typeof f.l1).toBe('string');
        expect(typeof f.l3).toBe('string');
      }
    }
  });
});

describe('search — 기본 동작', () => {
  const idx = buildSearchIndex(PRODUCTS, CAFE);

  it('빈 쿼리는 빈 배열 반환', () => {
    expect(search(idx, '')).toEqual([]);
    expect(search(idx, '   ')).toEqual([]);
  });

  it('매치 없는 쿼리는 빈 배열', () => {
    expect(search(idx, '!!존재하지않는!!')).toEqual([]);
  });

  it('매치된 결과는 스코어 내림차순 정렬', () => {
    const results = search(idx, '커피');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

describe('search — Layer 별 매치', () => {
  const idx = buildSearchIndex(PRODUCTS, CAFE);

  it('L1 직접 매치 — 상품명 일부', () => {
    const results = search(idx, '가을');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('가을의 밤 Autumn Night');
    expect(results[0].layer).toBe(1);
  });

  it('L2 동의어 매치 — "coffee" → "Coffee Bean" 카테고리 항목 히트', () => {
    // category 필드에 "Coffee Bean" 이 들어가므로 L1 direct substring 으로 매치됨.
    // 동의어 사전 빌드 회귀 조기 탐지 목적으로 결과 존재만 검증.
    const results = search(idx, 'coffee');
    expect(results.length).toBeGreaterThan(0);
  });

  it('L2 동의어 — "아아" → "아이스아메리카노" 매치', () => {
    const results = search(idx, '아아');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('아이스 아메리카노');
    expect(results[0].layer).toBe(2);
  });

  it('L3 음운 매치 — "라테" → "라떼"', () => {
    const results = search(idx, '라테');
    expect(results.some((r) => r.item.name === '말차 라떼')).toBe(true);
  });

  it('L4 초성 — "ㅇㄱㄹㅇ" → "얼그레이"', () => {
    const results = search(idx, 'ㅇㄱㄹㅇ');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('얼그레이');
    expect(results[0].layer).toBe(4);
  });
});

describe('search — 단음절 가드 회귀 방지', () => {
  it('"티" 쿼리가 desc 의 "스페셜티" 오매칭 차단 (가상 케이스)', () => {
    // desc 에 "티" 포함된 상품 추가
    const withTiInDesc = mkProduct({
      name: '블렌드X',
      slug: 'x',
      desc: '스페셜티 퀄리티를 담은 커피',
    });
    const customIdx = buildSearchIndex([...PRODUCTS, withTiInDesc], CAFE);
    const results = search(customIdx, '티');
    // desc 의 "티" 는 매치되지 않아야 함
    expect(results.some((r) => r.item.name === '블렌드X')).toBe(false);
    // 하지만 name 에 "티" 가 들어있는 항목은 매치됨 (자몽 허니 블랙티, 얼그레이 제외)
    expect(results.some((r) => r.item.name === '자몽 허니 블랙티')).toBe(true);
  });

  it('"티" 쿼리가 "디카페인" 으로 L3 오매칭 차단', () => {
    const decaf = mkProduct({ name: '디카페인 블렌드', slug: 'decaf' });
    const customIdx = buildSearchIndex([...PRODUCTS, decaf], CAFE);
    const results = search(customIdx, '티');
    expect(results.some((r) => r.item.name === '디카페인 블렌드')).toBe(false);
  });
});

describe('search — 랭킹 개선 (A+C)', () => {
  const idx = buildSearchIndex(PRODUCTS, CAFE);

  it('name 매치가 desc 매치보다 먼저 나온다', () => {
    // "자몽" — name 에 포함된 "자몽 허니 블랙티" vs desc 에 "자몽향" 포함된 경우
    const results = search(idx, '자몽');
    expect(results[0].item.name).toBe('자몽 허니 블랙티');
  });

  it('exact name 매치가 prefix/substring 보다 높은 스코어', () => {
    const exact = mkProduct({ name: '커피', slug: 'coffee-exact' });
    const prefix = mkProduct({ name: '커피빈', slug: 'coffee-prefix' });
    const substring = mkProduct({ name: '스페셜커피', slug: 'coffee-sub' });
    const customIdx = buildSearchIndex([substring, prefix, exact], []);
    const results = search(customIdx, '커피');
    expect(results[0].item.name).toBe('커피');
    expect(results[1].item.name).toBe('커피빈');
    expect(results[2].item.name).toBe('스페셜커피');
  });
});

describe('search — 하이라이트 span (E)', () => {
  const idx = buildSearchIndex(PRODUCTS, CAFE);

  it('매치 결과는 raw 기준 span 을 포함한다', () => {
    const results = search(idx, 'autumn');
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(top.spans.length).toBeGreaterThan(0);
    const span = top.spans.find((s) => s.field === 'name');
    expect(span).toBeDefined();
    if (!span) return;
    // raw name: '가을의 밤 Autumn Night'
    //                     ^ index 6
    expect(top.item.name.slice(span.start, span.end).toLowerCase()).toBe('autumn');
  });
});
