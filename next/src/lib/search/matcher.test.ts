import { describe, expect, it } from 'vitest';
import { buildSynonymIndex, buildIndexedField, matchField, matchEntry } from './matcher';
import type { SearchIndexEntry } from './types';
import type { Product } from '@/lib/products';
import type { CafeMenuItem } from '@/lib/cafeMenu';

describe('buildSynonymIndex — equivalence class → 양방향 reverse index', () => {
  it('각 토큰이 같은 클래스의 다른 토큰들을 반환한다', () => {
    const idx = buildSynonymIndex();
    // 'coffee' → ['커피'] 이고, '커피' → ['coffee'] 양방향
    expect(idx.get('coffee')).toContain('커피');
    expect(idx.get('커피')).toContain('coffee');
  });

  it('자기 자신은 포함하지 않는다', () => {
    const idx = buildSynonymIndex();
    const synonyms = idx.get('coffee') ?? [];
    expect(synonyms).not.toContain('coffee');
  });

  it('normalize 된 키(L1)로 저장된다 — "drip bag" → "dripbag"', () => {
    const idx = buildSynonymIndex();
    // 'drip bag' 은 L1 → 'dripbag' 로 저장
    expect(idx.has('dripbag')).toBe(true);
    expect(idx.get('dripbag')).toContain('드립백');
  });

  it('다중 토큰 클래스의 모든 페어를 양방향 연결한다', () => {
    const idx = buildSynonymIndex();
    // ['donut', 'donuts', 'doughnut', '도나쓰', '도너츠', '도나츠', '도너쓰']
    const fromDonut = idx.get('donut') ?? [];
    expect(fromDonut).toContain('도나쓰');
    expect(fromDonut).toContain('도너츠');
    expect(fromDonut).toContain('doughnut');
    expect(fromDonut).not.toContain('donut'); // 자기 자신 제외
  });

  it('같은 클래스 내 L1-등가 토큰 자기참조 차단 — "drip bag" / "dripbag"', () => {
    // SYNONYM_CLASSES 에 ['dripbag', 'drip bag', '드립백'] 가 있음.
    // 'drip bag' 은 L1 → 'dripbag' 이므로 'dripbag' 키의 siblings 에
    // 자기 자신이 포함되면 버그. 명시적으로 차단되는지 회귀 방지.
    const idx = buildSynonymIndex();
    const fromDripbag = idx.get('dripbag') ?? [];
    expect(fromDripbag).not.toContain('dripbag');
    expect(fromDripbag).not.toContain('drip bag');
    expect(fromDripbag).toContain('드립백');
  });
});

describe('buildIndexedField — 필드 전처리', () => {
  it('name 필드는 nameOnly=true 이고 weight 가 가장 높다', () => {
    const f = buildIndexedField('name', '가을의 밤 Autumn Night');
    expect(f.key).toBe('name');
    expect(f.isNameOnly).toBe(true);
    expect(f.weight).toBe(100);
    expect(f.raw).toBe('가을의 밤 Autumn Night');
    expect(f.l1).toBe('가을의밤autumnnight');
  });

  it('desc 필드는 nameOnly=false', () => {
    const f = buildIndexedField('desc', 'Good coffee');
    expect(f.isNameOnly).toBe(false);
    expect(f.weight).toBeLessThan(100);
  });
});

describe('matchField — Layer 1 직접 매치', () => {
  it('L1 정규화 후 포함되면 score + span 반환', () => {
    const field = buildIndexedField('name', '가을의 밤 Autumn Night');
    const r = matchField(field, 'autumn');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.layer).toBe(1);
    expect(r.score).toBeGreaterThan(0);
    expect(r.spans.length).toBe(1);
    // raw 기준 'Autumn' 위치 (인덱스 6)
    expect(r.spans[0].start).toBe(6);
    expect(r.spans[0].end).toBe(12);
    expect(r.spans[0].field).toBe('name');
  });

  it('한글 매치도 raw 기준 올바른 offset 반환', () => {
    const field = buildIndexedField('name', '가을의 밤');
    const r = matchField(field, '가을');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.spans[0].start).toBe(0);
    expect(r.spans[0].end).toBe(2);
  });

  it('matched=false 이면 spans 없음', () => {
    const field = buildIndexedField('name', 'Autumn');
    const r = matchField(field, 'spring');
    expect(r.matched).toBe(false);
  });
});

describe('matchField — Layer 3 음운 정규화 매치', () => {
  it('거센소리 쿼리가 평음 변환 후 매치된다', () => {
    // "라떼" L3 → "라데" (된소리 ㄸ → 평음 ㄷ).
    // "라테" L3 → "라데" (거센소리 ㅌ → 평음 ㄷ).
    // L3 정규화 후 양쪽 모두 "라데" 로 일치하므로 layer ≤ 3 에서 매치.
    const field = buildIndexedField('name', '라떼');
    const r = matchField(field, '라테');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.layer).toBeLessThanOrEqual(3);
  });
});

describe('matchField — Layer 2 동의어 매치', () => {
  it('동의어로 연결된 쿼리가 매치된다', () => {
    // name 에 "커피" 가 들어있으면 "coffee" 쿼리에 매치
    const field = buildIndexedField('name', '가을 커피 블렌드');
    const r = matchField(field, 'coffee');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.layer).toBe(2);
  });
});

describe('matchField — 단음절 가드', () => {
  it('단음절 한글은 name/category 필드만 매치된다', () => {
    // desc 필드에 "퀄리티" 포함 — "티" 쿼리는 단음절이므로 desc 매치 안됨
    const desc = buildIndexedField('desc', '스페셜티 퀄리티 커피');
    const r = matchField(desc, '티');
    expect(r.matched).toBe(false);
  });

  it('단음절 한글이 name 필드에 포함되면 매치된다 (L3 스킵)', () => {
    const name = buildIndexedField('name', '밀크티');
    const r = matchField(name, '티');
    expect(r.matched).toBe(true);
  });

  it('단음절 한글 L3 스킵: "티" 가 "디" 변환 없이 매치', () => {
    // name 필드 "디카페인" — L3 로 변환하면 "디카베인" → "티" L3 시 "디" 와 일치해버림
    // 단음절 가드 덕분에 L3 스킵 → "티" 는 "디카페인"과 매치 안됨
    const name = buildIndexedField('name', '디카페인');
    const r = matchField(name, '티');
    expect(r.matched).toBe(false);
  });
});

describe('matchField — Layer 4 초성 검색', () => {
  it('초성 쿼리가 nameOnly 필드에 매치된다', () => {
    const name = buildIndexedField('name', '가을의밤');
    const r = matchField(name, 'ㄱㅇ');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.layer).toBe(4);
  });

  it('초성 쿼리는 desc 필드에 매치되지 않는다', () => {
    const desc = buildIndexedField('desc', '가을의밤 블렌드');
    const r = matchField(desc, 'ㄱㅇ');
    expect(r.matched).toBe(false);
  });
});

describe('matchEntry — 여러 필드 중 최고 스코어 매치 선택', () => {
  const makeProduct = (): Product => ({
    category: 'Coffee Bean',
    name: '가을의 밤 Autumn Night',
    price: '14,000원',
    volumes: [],
    color: '',
    status: null,
    slug: 'autumn-night',
    subscription: true,
    images: [],
    desc: '블렌드입니다',
    specs: 'Espresso Blend',
    note: { sweet: 0, body: 0, aftertaste: 0, aroma: 0, acidity: 0 },
    noteTags: 'Nutty',
    noteColor: '#000',
    roastStage: 'medium',
    recipe: [],
  });

  const makeEntry = (p: Product): SearchIndexEntry => ({
    kind: 'product',
    item: p,
    fields: [
      buildIndexedField('name', p.name),
      buildIndexedField('category', p.category),
      buildIndexedField('desc', p.desc),
      buildIndexedField('specs', p.specs),
      buildIndexedField('noteTags', p.noteTags),
    ],
    nameChosung: '',
  });

  it('name 매치가 desc 매치보다 높은 스코어', () => {
    const entry = makeEntry(makeProduct());
    const rName = matchEntry(entry, '가을');
    const rDesc = matchEntry(entry, '블렌드');
    expect(rName.matched).toBe(true);
    expect(rDesc.matched).toBe(true);
    if (!rName.matched || !rDesc.matched) return;
    expect(rName.score).toBeGreaterThan(rDesc.score);
  });

  it('미매치 쿼리는 matched=false', () => {
    const entry = makeEntry(makeProduct());
    expect(matchEntry(entry, '자몽').matched).toBe(false);
  });

  it('L1 직접 매치가 동의어 매치보다 높은 스코어', () => {
    const p = makeProduct();
    p.name = '커피'; // "coffee" 와 동의어
    const entry = makeEntry(p);
    const rDirect = matchEntry(entry, '커피');   // L1
    const rSynonym = matchEntry(entry, 'coffee'); // L2
    expect(rDirect.matched).toBe(true);
    expect(rSynonym.matched).toBe(true);
    if (!rDirect.matched || !rSynonym.matched) return;
    expect(rDirect.score).toBeGreaterThan(rSynonym.score);
  });
});

describe('matchEntry — cafe menu', () => {
  const makeCafe = (): CafeMenuItem => ({
    id: 'iced-americano',
    name: '아이스 아메리카노',
    cat: 'brewing',
    status: '',
    temp: 'ice-only',
    badge2: '',
    price: 4500,
    desc: '',
    img: '',
    bg: '',
    menuDesc: '에스프레소에 물을 더한 기본 메뉴',
    vol: '355ml',
    kcal: 10,
    satfat: '0g',
    sugar: '0g',
    sodium: '10mg',
    protein: '1g',
    caffeine: '150mg',
    allergen: '없음',
  });

  const makeEntry = (c: CafeMenuItem): SearchIndexEntry => ({
    kind: 'cafe',
    item: c,
    fields: [
      buildIndexedField('name', c.name),
      buildIndexedField('category', c.cat),
      buildIndexedField('menuDesc', c.menuDesc),
    ],
    nameChosung: '',
  });

  it('축약어 "아아" 가 "아이스아메리카노" 와 매치된다 (동의어)', () => {
    const entry = makeEntry(makeCafe());
    const r = matchEntry(entry, '아아');
    expect(r.matched).toBe(true);
    if (!r.matched) return;
    expect(r.layer).toBe(2);
  });
});
