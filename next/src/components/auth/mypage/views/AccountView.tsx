/* ══════════════════════════════════════════
   AccountView — 계정관리 view (S197 PR-2 §2.7)
   PasswordChangeForm (ProfileView 에서 이관) + AccountDeleteSection.

   S258 P3: 개인정보 권리 행사 채널 안내 행 추가 (PIPA §35~37).
   S263 B-3: 권리 행사 행 → 회원 탈퇴 아래 정보 문구 (.mp-rights-note) 로 이동.
              inline edit 가능 행이 아닌 안내 텍스트로 시각 분리.
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
      <AccountDeleteSection onLoggedOut={onLoggedOut} />
      <p className="mp-rights-note">
        열람·정정·처리정지 등 개인정보 권리는{' '}
        <a href="mailto:privacy@goodthingsroasters.com">privacy@goodthingsroasters.com</a>
        {' '}또는{' '}
        <Link href="/legal/privacy">개인정보처리방침</Link>
        을 통해 행사하실 수 있습니다.
      </p>
    </div>
  );
}
