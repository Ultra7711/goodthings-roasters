'use client';

import NewsletterToggleClient from './NewsletterToggleClient';

type Props = {
  name: string;
  email: string;
};

export default function AccountInfoRow({ name, email }: Props) {
  return (
    <>
      <div className="mp-info-row">
        <span className="mp-info-label">이름</span>
        <span className="mp-info-value">{name}</span>
      </div>
      <div className="mp-info-row">
        <span className="mp-info-label">이메일</span>
        <span className="mp-info-value">{email}</span>
      </div>
      {/* S241 Phase 2 — newsletter 토글 (이메일 row 직속 아래 · 디폴트 ON) */}
      <NewsletterToggleClient />
    </>
  );
}
