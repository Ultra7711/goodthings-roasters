'use client';

import type { NewsletterStatusResult } from '@/lib/newsletter';
import { isSyntheticEmail } from '@/lib/auth/syntheticEmail';
import NewsletterToggleClient from './NewsletterToggleClient';

type Props = {
  name: string;
  email: string;
  /* S283: newsletter status SSR prefetch — view 전환 시 "불러오는 중…" 폐기. */
  initialNewsletterStatus?: NewsletterStatusResult;
};

export default function AccountInfoRow({ name, email, initialNewsletterStatus }: Props) {
  /* S301: 카카오/네이버 이메일 미제공 시 가상 이메일(kakao_..@kakao-oauth.internal)이
     계정 식별자로 생성됨 → 프로필에 그대로 노출하면 "암호 같은" 비친화 표시.
     실제 수신 불가 주소이므로 "미등록"으로 표시. (주문/배송 메일은 contact_email 사용 — 무관) */
  const emailIsSynthetic = isSyntheticEmail(email);

  return (
    <>
      <div className="mp-info-row">
        <span className="mp-info-label">이름</span>
        <span className="mp-info-value">{name}</span>
      </div>
      <div className="mp-info-row">
        <span className="mp-info-label">이메일</span>
        <span className={`mp-info-value${emailIsSynthetic ? ' mp-info-value--muted' : ''}`}>
          {emailIsSynthetic ? '미등록' : email}
        </span>
      </div>
      {/* S241 Phase 2 — newsletter 토글 (이메일 row 직속 아래 · 디폴트 ON)
         S283 — initialStatus 로 client fetch spinner 폐기.
         S301 — 가상 이메일(수신 불가) 유저는 토글 숨김 + 안내 (구독해도 발송 불가). */}
      {emailIsSynthetic ? (
        <div className="mp-info-row">
          <span className="mp-info-label">뉴스레터</span>
          <span className="mp-info-value mp-info-value--muted">이메일 등록 후 이용 가능</span>
        </div>
      ) : (
        <NewsletterToggleClient initialStatus={initialNewsletterStatus} />
      )}
    </>
  );
}
