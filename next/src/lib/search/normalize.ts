/* ══════════════════════════════════════════
   Search — Layer 1 & Layer 3 Normalization
   프로토타입 _srchL1 / _srchL3 이식.
   추가로 normalizeL1WithMap — raw offset 매핑 반환 (하이라이트용).
   ══════════════════════════════════════════ */

import { CHO_NORMALIZE_MAP, JONG_NORMALIZE_MAP } from './constants';

/** L1 에서 제거되는 문자 패턴 — 공백·하이픈·중점·점 */
const L1_STRIP_REGEX = /[\s\-·.]/;

/**
 * Layer 1: 공백·특수문자 제거 + 소문자화.
 * 프로토타입 `_srchL1(s) = s.toLowerCase().replace(/[\s\-·.]+/g,'')`.
 */
export function normalizeL1(s: string): string {
  let out = '';
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (!L1_STRIP_REGEX.test(ch)) out += ch;
  }
  return out;
}

/**
 * L1 정규화 + raw 오프셋 매핑 반환.
 * `rawOffsetByL1[i]` = L1 결과의 i번째 문자가 raw 에서 있던 위치.
 * 하이라이트 span 계산 시 필수.
 */
export function normalizeL1WithMap(s: string): {
  l1: string;
  rawOffsetByL1: number[];
} {
  let l1 = '';
  const rawOffsetByL1: number[] = [];
  const lower = s.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (!L1_STRIP_REGEX.test(ch)) {
      l1 += ch;
      rawOffsetByL1.push(i);
    }
  }
  return { l1, rawOffsetByL1 };
}

/**
 * Layer 3: 된소리·거센소리 → 평음 변환 (NFD 분해 → 매핑 → NFC 재조합).
 * NFC 재조합 누락 시 NFD 분해 상태로 substring 오매칭 발생 — 필수.
 * 프로토타입 `_srchL3(s)` 이식.
 */
export function normalizeL3(s: string): string {
  const decomposed = s.normalize('NFD');
  let mapped = '';
  for (let i = 0; i < decomposed.length; i++) {
    const ch = decomposed[i];
    mapped += CHO_NORMALIZE_MAP[ch] ?? JONG_NORMALIZE_MAP[ch] ?? ch;
  }
  return mapped.normalize('NFC');
}

/** L1 + L3 조합 — 프로토타입 `_srchNorm` 이식 */
export function normalizeFull(s: string): string {
  return normalizeL3(normalizeL1(s));
}
