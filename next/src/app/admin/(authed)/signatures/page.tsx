/* ══════════════════════════════════════════
   AdminSignaturesPage — server component (S270 Phase 3b · 071)
   listBannersAdmin('signature') 의 첫 row → <SignaturesForm initialSignature />.
   partial UNIQUE 가 1 row 보장하므로 [0]?.kind === 'signature' 확정.
   ══════════════════════════════════════════ */

import { listBannersAdmin } from '@/lib/admin/bannersServer';
import type { SignatureBanner } from '@/lib/banners';
import SignaturesForm from './SignaturesForm';

export default async function AdminSignaturesPage() {
  const banners = await listBannersAdmin('signature');
  const initialSignature: SignatureBanner | null =
    banners.find((b): b is SignatureBanner => b.kind === 'signature') ?? null;
  return <SignaturesForm initialSignature={initialSignature} />;
}
