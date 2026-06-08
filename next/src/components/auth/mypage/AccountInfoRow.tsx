'use client';

import type { NewsletterStatusResult } from '@/lib/newsletter';
import { isSyntheticEmail } from '@/lib/auth/syntheticEmail';
import NewsletterToggleClient from './NewsletterToggleClient';
import EmailRegisterForm from './EmailRegisterForm';
import NicknameEditForm from './NicknameEditForm';

type Props = {
  name: string;
  email: string;
  /* 유저 리뷰 작성자 표시명 — 자동생성 닉네임(편집 가능). */
  nickname: string;
  /* S283: newsletter status SSR prefetch — view 전환 시 "불러오는 중…" 폐기. */
  initialNewsletterStatus?: NewsletterStatusResult;
};

export default function AccountInfoRow({ name, email, nickname, initialNewsletterStatus }: Props) {
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
      <NicknameEditForm initialNickname={nickname} />
      {/* S302: 가상 이메일(미등록) 유저는 이메일 셀 자체가 등록 토글(배송지 패턴) →
         계정 자산(복구·CRM) 확보. 일반 유저는 기존 정적 이메일 row + 뉴스레터 토글.
         S301 — 가상 이메일 유저 뉴스레터는 "이메일 등록 후 이용 가능" 안내 (등록 시 토글 노출). */}
      {emailIsSynthetic ? (
        <>
          <EmailRegisterForm />
          <div className="mp-info-row">
            <span className="mp-info-label">뉴스레터</span>
            <span className="mp-info-value mp-info-value--muted">이메일 등록 후 이용 가능</span>
          </div>
        </>
      ) : (
        <>
          <div className="mp-info-row">
            <span className="mp-info-label">이메일</span>
            <span className="mp-info-value">{email}</span>
          </div>
          <NewsletterToggleClient initialStatus={initialNewsletterStatus} />
        </>
      )}
    </>
  );
}
