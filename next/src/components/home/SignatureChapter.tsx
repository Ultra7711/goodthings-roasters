/* ══════════════════════════════════════════
   SignatureChapter — server data fetcher (S146 V2 §2.2 PR-1 / S148 PR-2 분리)

   책임:
   - fetchSiteSettings 으로 signature 영역 fetch
   - SignatureChapterView 에 위임 (presentational)

   미리보기 / 메인 페이지 의 분기 위치:
   - 메인 페이지 (`/`) → 본 SignatureChapter (DB fetch)
   - /preview/signature (어드민) → SignatureChapterView 직접 호출 (URL 파라미터 → SignatureSettings)

   참조: SignatureChapterView.tsx
   ══════════════════════════════════════════ */

import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import SignatureChapterView from './SignatureChapterView';

export default async function SignatureChapter() {
  const { signature } = await fetchSiteSettings();
  return <SignatureChapterView signature={signature} />;
}
