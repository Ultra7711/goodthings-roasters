/* ══════════════════════════════════════════
   Search — Matcher
   필드 단위 스코어링 매치 엔진.
   - L1 직접 / L2 동의어 / L3 음운 / L4 초성 순으로 시도.
   - 매치 위치(span) 반환 → 하이라이트용.
   - equivalence class 기반 양방향 동의어 reverse index 빌드.
   ══════════════════════════════════════════ */

import { FIELD_WEIGHTS, MATCH_BONUS, SYNONYM_CLASSES } from './constants';
import { extractChosung, isChosungOnly, isSingleKoreanSyllable } from './chosung';
import { normalizeFull, normalizeL1, normalizeL1WithMap, normalizeL3 } from './normalize';
import type {
  FieldKey,
  IndexedField,
  MatchResult,
  MatchSpan,
  SearchIndexEntry,
  SearchLayer,
} from './types';

/** 필드별 nameOnly 플래그 (초성 검색 대상 여부) */
const NAME_ONLY_FIELDS: ReadonlySet<FieldKey> = new Set(['name', 'category']);

/* ── 동의어 reverse index 빌드 ──────────────────────────────
   equivalence class 의 모든 토큰을 양방향으로 연결.
   키는 normalizeL1 결과 (쿼리 비교 효율).
*/
export function buildSynonymIndex(): Map<string, readonly string[]> {
  /* 중간 자료구조로 Set 사용 — O(1) 중복 제거 + 자기참조(normalizeL1 이 같은 키로 수렴하는 경우) 필터.
     같은 클래스 내 'coffee bean' / 'coffeebean' 처럼 L1 결과가 동일한 토큰이
     siblings 에 섞이면 "자기 자신의 동의어" 상태가 되어 향후 매칭 순서 변경 시
     조용한 버그가 되므로 명시적으로 제외. */
  const map = new Map<string, Set<string>>();
  for (const cls of SYNONYM_CLASSES) {
    const normalizedTokens = cls.map((t) => normalizeL1(t));
    for (let i = 0; i < normalizedTokens.length; i++) {
      const key = normalizedTokens[i];
      if (!key) continue;
      const bucket = map.get(key) ?? new Set<string>();
      for (let j = 0; j < cls.length; j++) {
        if (j === i) continue;
        const sibling = cls[j];
        // 자기참조 차단: sibling 의 L1 이 key 와 같으면 제외
        if (normalizedTokens[j] === key) continue;
        bucket.add(sibling);
      }
      map.set(key, bucket);
    }
  }
  // readonly array 로 freeze 해 외부 변이 차단
  const frozen = new Map<string, readonly string[]>();
  for (const [k, v] of map) frozen.set(k, Object.freeze(Array.from(v)));
  return frozen;
}

/** 모듈 스코프 싱글톤 — buildSynonymIndex 1회 초기화 */
const SYNONYM_INDEX = buildSynonymIndex();

/* ── Field indexing ────────────────────────────────────── */

/**
 * 필드 하나를 pre-indexed 형태로 변환.
 * 로드 시 1회 호출 → 쿼리마다 normalize 재계산 회피.
 */
export function buildIndexedField(key: FieldKey, raw: string): IndexedField {
  const { l1, rawOffsetByL1 } = normalizeL1WithMap(raw);
  return {
    key,
    raw,
    l1,
    l3: normalizeL3(l1),
    rawOffsetByL1,
    isNameOnly: NAME_ONLY_FIELDS.has(key),
    weight: FIELD_WEIGHTS[key],
  };
}

/* ── Span 계산 유틸 ────────────────────────────────────── */

/**
 * L1 기준 매치 위치(l1Start~l1Start+l1Len) 를 raw 기준 span 으로 역변환.
 * rawOffsetByL1 매핑을 사용해 raw 상 실제 위치를 복원.
 */
function l1RangeToRawSpan(
  field: IndexedField,
  l1Start: number,
  l1Len: number,
): MatchSpan | null {
  if (l1Len <= 0) return null;
  if (l1Start < 0 || l1Start >= field.rawOffsetByL1.length) return null;
  const rawStart = field.rawOffsetByL1[l1Start];
  const lastIdx = l1Start + l1Len - 1;
  if (lastIdx >= field.rawOffsetByL1.length) return null;
  const rawEnd = field.rawOffsetByL1[lastIdx] + 1;
  return { field: field.key, start: rawStart, end: rawEnd };
}

/* ── 매치 시도 (Layer 별) ──────────────────────────────── */

type LayerMatch = {
  layer: SearchLayer;
  score: number;
  spans: MatchSpan[];
} | null;

/**
 * category 필드는 "non-coffee 논커피" · "Coffee Bean 커피빈 원두" 처럼
 * 복수 토큰을 공백으로 이어붙여 인덱싱한다. L1 정규화는 공백도 strip 하므로
 * 단순 substring 매치는 "커피" → "noncoffee논커피" 의 '논커피' 내부 hit,
 * "coffee" → "noncoffee" 내부 hit 같은 오매칭을 낳는다 (BUG-005).
 *
 * 해결: category 필드 한정, raw 기준 토큰 경계 확인.
 * 매치 시작의 raw 위치가 문자열 처음이거나 바로 앞 문자가 공백일 때만 허용.
 * (하이픈은 boundary 가 아님 — "non-coffee" 의 "coffee" 는 거부되어야 함)
 * prefix-of-token 은 허용 → "커피" 가 "커피빈" 머리에 걸리는 건 OK.
 */
function findBoundaryIndex(
  field: IndexedField,
  haystack: string,
  needle: string,
): number {
  if (field.key !== 'category') return haystack.indexOf(needle);
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx < 0) return -1;
    if (idx === 0) return idx;
    const rawStart = field.rawOffsetByL1[idx];
    if (rawStart === 0 || /\s/.test(field.raw[rawStart - 1])) return idx;
    from = idx + 1;
  }
  return -1;
}

/** L1 직접 매치 — field.l1 에 normalizedQuery 가 포함되는가 */
function tryLayer1(field: IndexedField, nQuery: string): LayerMatch {
  if (!nQuery) return null;
  const idx = findBoundaryIndex(field, field.l1, nQuery);
  if (idx < 0) return null;
  const span = l1RangeToRawSpan(field, idx, nQuery.length);
  if (!span) return null;
  const bonus = computeMatchBonus(field.l1, nQuery, idx);
  return {
    layer: 1,
    score: field.weight + bonus,
    spans: [span],
  };
}

/** L3 음운 정규화 매치 */
function tryLayer3(field: IndexedField, l3Query: string): LayerMatch {
  if (!l3Query) return null;
  const idx = findBoundaryIndex(field, field.l3, l3Query);
  if (idx < 0) return null;
  // L3 의 index 는 l1 문자 단위와 일치 (NFC 재조합 후 같은 음절 카운트).
  // 따라서 rawOffsetByL1 을 그대로 재사용 가능.
  const span = l1RangeToRawSpan(field, idx, l3Query.length);
  if (!span) return null;
  const bonus = computeMatchBonus(field.l3, l3Query, idx);
  return {
    layer: 3,
    score: field.weight + bonus,
    spans: [span],
  };
}

/** L2 동의어 매치 — 쿼리의 모든 동의어를 대상 필드에서 탐색 */
function tryLayer2(
  field: IndexedField,
  nQuery: string,
  useL3: boolean,
): LayerMatch {
  const synonyms = SYNONYM_INDEX.get(nQuery);
  if (!synonyms || synonyms.length === 0) return null;
  for (const syn of synonyms) {
    const nSyn = useL3 ? normalizeFull(syn) : normalizeL1(syn);
    const target = useL3 ? field.l3 : field.l1;
    if (!nSyn) continue;
    const idx = findBoundaryIndex(field, target, nSyn);
    if (idx < 0) continue;
    const span = l1RangeToRawSpan(field, idx, nSyn.length);
    if (!span) continue;
    return {
      layer: 2,
      score: field.weight + MATCH_BONUS.synonym,
      spans: [span],
    };
  }
  return null;
}

/** L4 초성 매치 — nameOnly 필드만, 쿼리 전체가 초성일 때 */
function tryLayer4(field: IndexedField, query: string): LayerMatch {
  if (!field.isNameOnly) return null;
  const cq = query.replace(/[\s\-·.]/g, '');
  if (!isChosungOnly(cq)) return null;
  // raw 필드의 초성 추출 (공백 제거 후) — 필드 로드 때 pre-compute 되어있지 않음.
  // 초성 검색은 상대적으로 드물므로 lazy 계산.
  const rawStripped = field.raw.replace(/[\s\-·.]/g, '');
  const chosungText = extractChosung(rawStripped);
  const idx = chosungText.indexOf(cq);
  if (idx < 0) return null;
  // 초성 매치의 span 계산은 복잡 (raw 공백 제거 인덱스 → raw 인덱스 역변환).
  // 일단 간단히: raw 에서 해당 시작 문자 찾아 span 반환 (근사).
  // 정확도는 하이라이트 UX 에 영향 미미.
  const stripMap: number[] = [];
  for (let i = 0; i < field.raw.length; i++) {
    if (!/[\s\-·.]/.test(field.raw[i])) stripMap.push(i);
  }
  if (idx >= stripMap.length) return null;
  const rawStart = stripMap[idx];
  const lastIdx = idx + cq.length - 1;
  if (lastIdx >= stripMap.length) return null;
  const rawEnd = stripMap[lastIdx] + 1;
  return {
    layer: 4,
    score: field.weight + MATCH_BONUS.chosung,
    spans: [{ field: field.key, start: rawStart, end: rawEnd }],
  };
}

/** 매치 bonus 계산 — exact / prefix / substring */
function computeMatchBonus(haystack: string, needle: string, idx: number): number {
  if (haystack === needle) return MATCH_BONUS.exact;
  if (idx === 0) return MATCH_BONUS.prefix;
  return MATCH_BONUS.substring;
}

/* ── Public API ────────────────────────────────────────── */

/**
 * 필드 한 개에 대해 쿼리를 매치. 상위 Layer 우선 탐색.
 * 단음절 가드: 쿼리가 단일 한글 음절이면 L3 스킵 + nameOnly 필드만.
 */
export function matchField(field: IndexedField, rawQuery: string): MatchResult {
  const trimmed = rawQuery.trim();
  if (!trimmed) return { matched: false };

  const isSingle = isSingleKoreanSyllable(trimmed);
  const cq = trimmed.replace(/[\s\-·.]/g, '');
  const queryIsChosung = isChosungOnly(cq);

  // 단음절은 nameOnly 필드만
  if (isSingle && !field.isNameOnly) return { matched: false };
  // 초성 쿼리는 L4 로 전용 처리
  if (queryIsChosung) {
    const r = tryLayer4(field, trimmed);
    return r ? { matched: true, ...r } : { matched: false };
  }

  const nQuery = normalizeL1(trimmed);
  if (!nQuery) return { matched: false };

  // L1 직접
  const r1 = tryLayer1(field, nQuery);
  if (r1) return { matched: true, ...r1 };

  // L2 동의어 — 단음절일 때는 L3 변환 안 씀
  const r2 = tryLayer2(field, nQuery, !isSingle);
  if (r2) return { matched: true, ...r2 };

  // L3 음운 정규화 (단음절 제외)
  if (!isSingle) {
    const l3Query = normalizeL3(nQuery);
    if (l3Query !== nQuery) {
      const r3 = tryLayer3(field, l3Query);
      if (r3) return { matched: true, ...r3 };
    }
  }

  return { matched: false };
}

/**
 * 엔트리 전체(모든 필드) 에 대해 매치 시도.
 * 필드별 매치 중 최고 스코어를 반환 (spans 는 해당 필드 것만).
 * 다중 필드 매치 시 상위 2개 필드의 spans 까지 합쳐 반환 (하이라이트 확대).
 */
export function matchEntry(entry: SearchIndexEntry, rawQuery: string): MatchResult {
  const matches: Array<{
    score: number;
    layer: SearchLayer;
    spans: MatchSpan[];
  }> = [];

  for (const field of entry.fields) {
    const r = matchField(field, rawQuery);
    if (r.matched) {
      matches.push({ score: r.score, layer: r.layer, spans: r.spans });
    }
  }

  if (matches.length === 0) return { matched: false };

  // 최고 스코어 + 합산 bonus (여러 필드 매치 시)
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  const multiFieldBonus = matches.length > 1 ? Math.min(matches.length - 1, 3) * 5 : 0;

  return {
    matched: true,
    score: best.score + multiFieldBonus,
    layer: best.layer,
    spans: matches.flatMap((m) => m.spans),
  };
}
