/* ══════════════════════════════════════════
   Search — Engine
   Products + Cafe Menu 통합 검색 엔진.
   개선 A: pre-indexed fields — 모듈 로드 시 1회 인덱싱.
   개선 C: 매치 스코어 기반 랭킹 — 상품/메뉴 인터리브.
   ══════════════════════════════════════════ */

import type { CafeMenuItem } from '@/lib/cafeMenu';
import type { Product } from '@/lib/products';
import { CAT_LABEL } from './constants';
import { buildIndexedField, matchEntry } from './matcher';
import { extractChosung } from './chosung';
import type { LegalSearchItem, SearchIndexEntry, SearchResult } from './types';

/**
 * nameOnly 통합 초성 문자열 계산 — L4 초성 검색 최적화용.
 * 현재 matcher.ts 는 필드 단위로 lazy 추출하므로 엔트리 레벨 초성 필드는 보조 역할.
 */
function computeNameChosung(raw: string): string {
  const stripped = raw.replace(/[\s\-·.]/g, '');
  return extractChosung(stripped);
}

/**
 * Products 를 인덱스 엔트리로 변환.
 * 검색 대상 필드: name, category, noteTags, desc, specs.
 * category 는 원본 키 + CAT_LABEL 한글 라벨 함께 포함 → "원두" 쿼리로 "Coffee Bean" 매치.
 */
function indexProduct(p: Product): SearchIndexEntry {
  const categoryText = p.category + ' ' + (CAT_LABEL[p.category] ?? '');
  return {
    kind: 'product',
    item: p,
    fields: [
      buildIndexedField('name', p.name),
      buildIndexedField('category', categoryText),
      buildIndexedField('noteTags', p.noteTags ?? ''),
      buildIndexedField('desc', p.desc ?? ''),
      buildIndexedField('specs', p.specs ?? ''),
    ],
    nameChosung: computeNameChosung(p.name + ' ' + categoryText),
  };
}

/** Cafe Menu 를 인덱스 엔트리로 변환. */
function indexCafeMenu(c: CafeMenuItem): SearchIndexEntry {
  const categoryText = c.cat + ' ' + (CAT_LABEL[c.cat] ?? '');
  return {
    kind: 'cafe',
    item: c,
    fields: [
      buildIndexedField('name', c.name),
      buildIndexedField('category', categoryText),
      buildIndexedField('menuDesc', c.menuDesc ?? ''),
    ],
    nameChosung: computeNameChosung(c.name + ' ' + categoryText),
  };
}

/** Legal doc 을 인덱스 엔트리로 변환 (S280).
 *  - legalTitle (가중치 80) — 페이지 제목 (예: "개인정보처리방침")
 *  - legalBody (가중치 10) — description + sections 본문 전체
 *  초성 검색은 title 만 (본문 초성은 노이즈 가능성 큼). */
function indexLegal(l: LegalSearchItem): SearchIndexEntry {
  return {
    kind: 'legal',
    item: l,
    fields: [
      buildIndexedField('legalTitle', l.title),
      buildIndexedField('legalBody', l.body),
    ],
    nameChosung: computeNameChosung(l.title),
  };
}

/**
 * 모든 검색 대상을 한 번에 인덱싱.
 * 모듈 스코프에서 호출하여 싱글톤으로 사용하거나, 테스트에서 커스텀 데이터로 호출 가능.
 * S280: legal docs 인덱싱 추가.
 */
export function buildSearchIndex(
  products: readonly Product[],
  cafeMenu: readonly CafeMenuItem[],
  legal: readonly LegalSearchItem[] = [],
): SearchIndexEntry[] {
  return [
    ...products.map((p) => indexProduct(p)),
    ...cafeMenu.map((c) => indexCafeMenu(c)),
    ...legal.map((l) => indexLegal(l)),
  ];
}

/**
 * 통합 검색 — 인덱스 전체를 스캔하여 매치된 엔트리만 스코어 내림차순 반환.
 */
export function search(
  index: readonly SearchIndexEntry[],
  rawQuery: string,
): SearchResult[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [];

  const results: SearchResult[] = [];
  for (const entry of index) {
    const r = matchEntry(entry, trimmed);
    if (!r.matched) continue;
    // SearchIndexEntry 가 discriminated union 이므로 kind 별로 SearchResult 생성
    if (entry.kind === 'product') {
      results.push({
        kind: 'product',
        item: entry.item,
        score: r.score,
        layer: r.layer,
        spans: r.spans,
      });
    } else if (entry.kind === 'cafe') {
      results.push({
        kind: 'cafe',
        item: entry.item,
        score: r.score,
        layer: r.layer,
        spans: r.spans,
      });
    } else {
      /* legal (S280) */
      results.push({
        kind: 'legal',
        item: entry.item,
        score: r.score,
        layer: r.layer,
        spans: r.spans,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
