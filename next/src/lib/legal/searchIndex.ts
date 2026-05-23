/* ══════════════════════════════════════════════════════════════════════════
   lib/legal/searchIndex.ts — Legal docs 검색 인덱스 변환 (S280)

   역할:
   - LEGAL_DOCS 의 6 페이지 (terms · privacy · business-info · shipping · returns
     · payment-faq) 를 검색 엔진의 `LegalSearchItem[]` 형태로 변환.
   - title (가중치 90) + body (가중치 15) 2 필드 인덱싱.
   - body = description + intro + sections (heading + paragraphs + bullets +
     definitions) + footer 모두 concat.

   설계:
   - 모듈 import 시점 정적 평가 (DB 호출 없음).
   - site_settings token (`{shipping.base_fee}` 등) 은 raw 상태로 인덱싱 — 사용자
     검색은 자연어 ("배송비" 등) 이므로 token 자체 매치 불가능. 본문의 다른
     위치에서 "배송비" 단어로 매치됨.
   - effectiveDate 는 인덱싱 대상 아님 (검색 가치 낮음, 표시용).

   참조:
   - lib/search/types.ts — LegalSearchItem 타입
   - app/(main)/legal/[slug]/content.ts — LEGAL_SLUGS · LEGAL_DOCS · LegalDoc 정의
   ══════════════════════════════════════════════════════════════════════════ */

import {
  LEGAL_SLUGS,
  getLegalDoc,
  type LegalDoc,
  type LegalSection,
  type LegalSlug,
} from '@/app/(main)/legal/[slug]/content';
import type { LegalSearchItem } from '@/lib/search/types';

/** 한 LegalSection 의 모든 텍스트를 단일 문자열로 추출. */
function extractSectionText(s: LegalSection): string {
  const parts: string[] = [];
  if (s.heading) parts.push(s.heading);
  if (s.paragraphs) parts.push(...s.paragraphs);
  if (s.bullets) parts.push(...s.bullets);
  if (s.definitions) {
    for (const d of s.definitions) {
      parts.push(`${d.label} ${d.value}`);
    }
  }
  return parts.join(' ');
}

/** LegalDoc 의 body 텍스트 (description + intro + sections + footer) 단일 문자열. */
function extractBody(doc: LegalDoc): string {
  const parts: string[] = [doc.description];
  if (doc.intro) parts.push(...doc.intro);
  parts.push(...doc.sections.map(extractSectionText));
  if (doc.footer) parts.push(...doc.footer);
  return parts.join(' ');
}

/** LegalSlug → LegalSearchItem 변환. */
function toLegalSearchItem(slug: LegalSlug): LegalSearchItem {
  const doc = getLegalDoc(slug);
  return {
    slug,
    title: doc.title,
    description: doc.description,
    body: extractBody(doc),
  };
}

/** 전체 6 docs 의 LegalSearchItem 배열. 모듈 import 시점 1회 평가. */
export const LEGAL_SEARCH_ITEMS: readonly LegalSearchItem[] = LEGAL_SLUGS.map(
  toLegalSearchItem,
);
