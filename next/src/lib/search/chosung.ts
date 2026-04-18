/* ══════════════════════════════════════════
   Search — Layer 4: 초성 검색 + 단음절 가드
   프로토타입 _getChosung / _isChosungOnly + 단음절 판정.
   ══════════════════════════════════════════ */

import {
  CHOSUNG_LIST,
  HANGUL_CHO_COUNT,
  HANGUL_JONG_COUNT,
  HANGUL_JUNG_COUNT,
  HANGUL_SYLLABLE_END,
  HANGUL_SYLLABLE_START,
} from './constants';

/** 완성형 한글 음절 1글자에서 초성 1글자 추출 */
function choOfSyllable(code: number): string | null {
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return null;
  const offset = code - HANGUL_SYLLABLE_START;
  const choIdx = Math.floor(offset / (HANGUL_JUNG_COUNT * HANGUL_JONG_COUNT));
  if (choIdx < 0 || choIdx >= HANGUL_CHO_COUNT) return null;
  return CHOSUNG_LIST[choIdx];
}

/**
 * 문자열 각 한글 음절을 초성으로 치환. 비한글 문자는 그대로 유지.
 * 프로토타입 `_getChosung` 이식.
 */
export function extractChosung(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const cho = choOfSyllable(ch.charCodeAt(0));
    out += cho ?? ch;
  }
  return out;
}

/**
 * 쿼리 전체가 초성(ㄱ–ㅎ, U+3131–U+314E)으로만 구성됐는지.
 * 프로토타입 `_isChosungOnly`: `/^[ㄱ-ㅎ]+$/`.
 */
export function isChosungOnly(s: string): boolean {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // ㄱ(U+3131) ~ ㅎ(U+314E)
    if (code < 0x3131 || code > 0x314e) return false;
  }
  return true;
}

/**
 * 단음절 한글 판정 — 공백·하이픈·중점·점 제거 후 1글자이면서 완성형 한글인지.
 * 단음절일 때는 Layer 3 정규화 스킵 + nameOnly 필드만 매칭 (오매칭 방지).
 * 프로토타입 L5728–5729 이식.
 */
export function isSingleKoreanSyllable(s: string): boolean {
  const trimmed = s.replace(/[\s\-·.]/g, '');
  if (trimmed.length !== 1) return false;
  const code = trimmed.charCodeAt(0);
  return code >= HANGUL_SYLLABLE_START && code <= HANGUL_SYLLABLE_END;
}
