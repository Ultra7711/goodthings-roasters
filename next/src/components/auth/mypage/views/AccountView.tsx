/* ══════════════════════════════════════════
   AccountView — 계정관리 view (S197 PR-1.3.B)
   회원 탈퇴 only (비밀번호 변경은 ProfileView 로 이전).
   ══════════════════════════════════════════ */

'use client';

import AccountDeleteSection from '../AccountDeleteSection';

type Props = {
  onLoggedOut: () => void;
};

export default function AccountView({ onLoggedOut }: Props) {
  return (
    <div className="mp-section-body">
      <AccountDeleteSection onLoggedOut={onLoggedOut} />
    </div>
  );
}
