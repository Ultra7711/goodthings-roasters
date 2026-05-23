/* ══════════════════════════════════════════
   Search — Types
   프로토타입 goodthings_v1.0.html L5652–5721 스펙 이식 + 개선
   - 개선 A: pre-indexed search fields (types/SearchIndexEntry)
   - 개선 B: 동의어 equivalence class 양방향 자동 (constants/SYNONYM_CLASSES)
   - 개선 C: boolean → {matched, score, layer, spans} — 랭킹용
   - 개선 E: spans 반환 → 하이라이트 지원
   ══════════════════════════════════════════ */

import type { Product } from '@/lib/products';
import type { CafeMenuItem } from '@/lib/cafeMenu';

/** 매치가 발생한 Layer (L1 직접 / L2 동의어 / L3 음운 정규화 / L4 초성) */
export type SearchLayer = 1 | 2 | 3 | 4;

/** 검색 인덱스의 필드 식별자 */
export type FieldKey =
  | 'name'
  | 'category'
  | 'noteTags'
  | 'specs'
  | 'desc'
  | 'menuDesc'
  /* S280: legal 도메인 — title (높은 가중치) + body (낮은 가중치 · 본문 전체). */
  | 'legalTitle'
  | 'legalBody';

/** 매치된 span — 원본 텍스트(raw) 기준 오프셋. `<mark>` 렌더링용. */
export type MatchSpan = {
  field: FieldKey;
  /** raw 문자열 기준 시작 인덱스 */
  start: number;
  /** raw 문자열 기준 끝 인덱스 (exclusive) */
  end: number;
};

/** 매치 결과 — boolean 대체: 점수 + layer + 하이라이트 span */
export type MatchResult =
  | { matched: false }
  | {
      matched: true;
      score: number;
      layer: SearchLayer;
      spans: MatchSpan[];
    };

/** 검색 대상 도메인 (S280: legal 추가) */
export type SearchItemKind = 'product' | 'cafe' | 'legal';

/** Legal 검색 결과 아이템 — slug + title + description + body 텍스트.
 *  body 는 인덱싱 전용, 결과 카드 표시는 description 사용. */
export type LegalSearchItem = {
  slug: string;
  title: string;
  description: string;
  /** 모든 section 의 paragraphs + bullets + definitions concat (인덱싱 전용). */
  body: string;
};

/** 인덱스된 필드 — 쿼리 시마다 정규화 재계산을 방지하기 위한 캐시 */
export type IndexedField = {
  key: FieldKey;
  /** 원본 텍스트 (하이라이트 offset 기준) */
  raw: string;
  /** L1 (공백/특수문자 제거 + lowercase) */
  l1: string;
  /** L1 + L3 (음운 정규화 후 NFC) */
  l3: string;
  /**
   * raw 인덱스 → l1/l3 인덱스 매핑은 불필요.
   * span 은 raw 의 l1 자릿수로 계산 후 역추적. 매핑 테이블:
   * rawOffsetByL1[i] = raw 상의 i 번째 L1 문자 위치
   */
  rawOffsetByL1: readonly number[];
  /** nameOnly 필드 여부 — 초성 검색 대상 (name, category) */
  isNameOnly: boolean;
  /** 필드 가중치 */
  weight: number;
};

/** 검색 인덱스 엔트리 — Product/CafeMenuItem/LegalSearchItem union (S280) */
export type SearchIndexEntry = {
  kind: 'product';
  item: Product;
  fields: IndexedField[];
  /** nameOnly 필드 통합 초성 (NFC) */
  nameChosung: string;
} | {
  kind: 'cafe';
  item: CafeMenuItem;
  fields: IndexedField[];
  nameChosung: string;
} | {
  kind: 'legal';
  item: LegalSearchItem;
  fields: IndexedField[];
  nameChosung: string;
};

/** 검색 인덱스 원본 데이터 (S215 + S280 legal) — buildSearchIndex 입력 + SSR prefetch 직렬화용 */
export type SearchIndexData = {
  products: Product[];
  cafeMenu: CafeMenuItem[];
  legal: LegalSearchItem[];
};

/** 검색 결과 — 스코어 내림차순 정렬된 상태로 반환 */
export type SearchResult =
  | {
      kind: 'product';
      item: Product;
      score: number;
      layer: SearchLayer;
      spans: MatchSpan[];
    }
  | {
      kind: 'cafe';
      item: CafeMenuItem;
      score: number;
      layer: SearchLayer;
      spans: MatchSpan[];
    }
  | {
      kind: 'legal';
      item: LegalSearchItem;
      score: number;
      layer: SearchLayer;
      spans: MatchSpan[];
    };
