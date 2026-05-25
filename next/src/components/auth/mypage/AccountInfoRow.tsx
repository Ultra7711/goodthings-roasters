'use client';

import type { NewsletterStatusResult } from '@/lib/newsletter';
import NewsletterToggleClient from './NewsletterToggleClient';

type Props = {
  name: string;
  email: string;
  /* S283: newsletter status SSR prefetch — view 전환 시 "불러오는 중…" 폐기. */
  initialNewsletterStatus?: NewsletterStatusResult;
};

export default function AccountInfoRow({ name, email, initialNewsletterStatus }: Props) {
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
      {/* S241 Phase 2 — newsletter 토글 (이메일 row 직속 아래 · 디폴트 ON)
         S283 — initialStatus 로 client fetch spinner 폐기. */}
      <NewsletterToggleClient initialStatus={initialNewsletterStatus} />
    </>
  );
}
