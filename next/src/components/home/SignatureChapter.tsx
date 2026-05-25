/* ══════════════════════════════════════════
   SignatureChapter — server data fetcher (S237 iframe 모델 · 062 · S270 Phase 3b)

   책임:
   - getActiveBanner('signature') 으로 banners 테이블에서 signature row fetch
   - SignatureChapterView 에 위임 (presentational)

   S270 Phase 3b — banners 통합:
   - 이전: fetchSiteSettings().signature (site_settings.signature row)
   - 이후: getActiveBanner('signature') (banners 테이블 · partial UNIQUE 1 row)
   - signature row 가 없거나 비활성이면 SignatureChapterView 가 null 반환.

   미리보기 / 메인 페이지 의 분기 위치:
   - 메인 페이지 (`/`) → 본 SignatureChapter (DB fetch)
   - /preview/signature (어드민) → SignatureChapterView 직접 호출

   참조: SignatureChapterView.tsx · EventBanner.tsx (답습)
   ══════════════════════════════════════════ */

import { connection } from 'next/server';
import { getActiveBanner } from '@/lib/bannersServer';
import type { SignatureBanner } from '@/lib/banners';
import SignatureChapterView from './SignatureChapterView';

export default async function SignatureChapter() {
  /* Next.js 16 cacheComponents:true 환경에서 PPR static shell 의 일부로
     prerender 되는 회귀 차단 — connection() 호출이 본 segment 를 dynamic 으로
     강제 (운영자 admin signature 변경 즉시 메인 반영 보장). */
  await connection();

  const banner = await getActiveBanner('signature');
  /* discriminated union → kind='signature' narrowing. selectActiveBanner 가 kind
     필터링 이미 적용했지만 type narrowing 위해 명시. */
  const signature: SignatureBanner | null =
    banner?.kind === 'signature' ? banner : null;
  if (!signature) return null;
  return <SignatureChapterView signature={signature} />;
}
