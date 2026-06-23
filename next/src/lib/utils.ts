/* ══════════════════════════════════════════
   Utility Functions
   ══════════════════════════════════════════ */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind 클래스 병합 (shadcn/ui 표준 헬퍼). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 가격 문자열에서 숫자만 추출 ("15,000원" → 15000) */
export function parsePrice(str: string): number {
  return parseInt(str.replace(/[₩,\s원]/g, ''), 10) || 0;
}

/** 숫자를 한국 원화 형식으로 포맷 (15000 → "15,000원") */
export function formatPrice(num: number): string {
  return `${num.toLocaleString('ko-KR')}원`;
}

/** 포인트를 표시 형식으로 포맷 (1200 → "1,200 P") */
export function formatPoints(num: number): string {
  return `${num.toLocaleString('ko-KR')} P`;
}

/** 상품명에서 한글 부분만 추출 ("에티오피아 예가체프 Ethiopia Yirgacheffe" → "에티오피아 예가체프") */
export function extractKrName(name: string): string {
  const m = name.match(
    /^(.*[\uAC00-\uD7AF](?:\s+[A-Z0-9]+)*)\s+([A-Z][a-z].*)$/,
  );
  return m ? m[1].trim() : name;
}

/** ISO-8601 또는 timestamptz 문자열을 "YYYY.MM.DD" 형식으로 변환 (KST 기준). */
export function formatDateKST(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** Open redirect 방어: 내부 경로(/...)만 허용, 프로토콜·호스트·스킴 혼입 차단. */
export function safeRedirectPath(path: string | null | undefined, fallback = '/'): string {
  if (!path) return fallback;
  if (!path.startsWith('/')) return fallback;
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(path)) return fallback;
  return path;
}
