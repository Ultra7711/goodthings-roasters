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
  | 'menuDesc';

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

/** 검색 대상 도메인 */
export type SearchItemKind = 'product' | 'cafe';

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

/** 검색 인덱스 엔트리 — Product/CafeMenuItem 은 union */
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
    };
