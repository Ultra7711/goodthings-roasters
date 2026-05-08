/* ══════════════════════════════════════════
   AccountView — 계정관리 view (S197 PR-2 §2.7)
   PasswordChangeForm (ProfileView 에서 이관) + AccountDeleteSection.
   ══════════════════════════════════════════ */

'use client';

import PasswordChangeForm from '../PasswordChangeForm';
import AccountDeleteSection from '../AccountDeleteSection';

type Props = {
  onLoggedOut: () => void;
};

export default function AccountView({ onLoggedOut }: Props) {
  return (
    <div className="mp-section-body">
      <PasswordChangeForm />
      <AccountDeleteSection onLoggedOut={onLoggedOut} />
    </div>
  );
}
