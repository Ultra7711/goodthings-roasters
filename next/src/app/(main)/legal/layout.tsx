/* ══════════════════════════════════════════
   Legal Layout — sidenav 만 layout 으로 분리 (S197).
   navigate 시 LegalSideNav instance 가 unmount 안 됨 → state preserve →
   activeSlug 변경 시 indicator slide 발화.
   hero 는 page (LegalPage) 가 doc 별로 렌더 (params 의존이라 client layout 호환 issue 회피).
   ══════════════════════════════════════════ */

import LegalSideNav from '@/components/legal/LegalSideNav';
import { LEGAL_NAV } from './[slug]/content';
import '@/components/legal/LegalPage.css';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-page" data-header-theme="light">
      <div className="legal-shell">
        <LegalSideNav items={LEGAL_NAV} />
        {children}
      </div>
    </div>
  );
}
