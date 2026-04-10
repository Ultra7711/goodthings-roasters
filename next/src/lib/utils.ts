/* ══════════════════════════════════════════
   Utility Functions
   ══════════════════════════════════════════ */

/** 가격 문자열에서 숫자만 추출 ("15,000원" → 15000) */
export function parsePrice(str: string): number {
  return parseInt(str.replace(/[₩,\s원]/g, ''), 10) || 0;
}

/** 숫자를 한국 원화 형식으로 포맷 (15000 → "15,000원") */
export function formatPrice(num: number): string {
  return `${num.toLocaleString('ko-KR')}원`;
}

/** 상품명에서 한글 부분만 추출 ("에티오피아 예가체프 Ethiopia Yirgacheffe" → "에티오피아 예가체프") */
export function extractKrName(name: string): string {
  const m = name.match(
    /^(.*[\uAC00-\uD7AF](?:\s+[A-Z0-9]+)*)\s+([A-Z][a-z].*)$/,
  );
  return m ? m[1].trim() : name;
}
