/* ══════════════════════════════════════════
   ProfileView — 프로필 view (S197 PR-1.3.B)
   AccountInfoRow (이름·이메일) + PasswordChangeForm (분리됨).
   ══════════════════════════════════════════ */

'use client';

import AccountInfoRow from '../AccountInfoRow';
import PasswordChangeForm from '../PasswordChangeForm';

type Props = {
  name: string;
  email: string;
};

export default function ProfileView({ name, email }: Props) {
  return (
    <div className="mp-section-body">
      <AccountInfoRow name={name} email={email} />
      <PasswordChangeForm />
    </div>
  );
}
