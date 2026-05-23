/* ══════════════════════════════════════════
   AccountView — 계정관리 view (S197 PR-2 §2.7)
   PasswordChangeForm (ProfileView 에서 이관) + AccountDeleteSection.

   S258 P3: 개인정보 권리 행사 채널 안내 행 추가 (PIPA §35~37).
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import PasswordChangeForm from '../PasswordChangeForm';
import AccountDeleteSection from '../AccountDeleteSection';

type Props = {
  onLoggedOut: () => void;
};

export default function AccountView({ onLoggedOut }: Props) {
  return (
    <div className="mp-section-body">
      <PasswordChangeForm />
      <div className="mp-info-row mp-info-row--rights">
        <span className="mp-info-label">개인정보 권리 행사</span>
        <span className="mp-info-value">
          열람·정정·처리정지 요청은{' '}
          <a href="mailto:privacy@goodthingsroasters.com">privacy@goodthingsroasters.com</a>
          {' '}·{' '}
          <Link href="/legal/privacy">개인정보처리방침</Link>
        </span>
      </div>
      <AccountDeleteSection onLoggedOut={onLoggedOut} />
    </div>
  );
}
