/* ══════════════════════════════════════════
   ContactSection — 연락처 (email)
   + 비로그인·미펼침 상태에서 로그인/게스트 진입 CTA.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { TextField } from '@/components/ui/TextField';

type InputNavHandler = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;

type ContactSectionProps = {
  email: string;
  emailError?: string;
  isFormRevealed: boolean;
  isLoggedIn: boolean;
  sessionLoading: boolean;
  onChangeEmail: (v: string) => void;
  onClearEmail: () => void;
  onBlurEmail: () => void;
  onKeyDown: InputNavHandler;
  onGuestContinue: () => void;
};

export default function ContactSection({
  email,
  emailError,
  isFormRevealed,
  isLoggedIn,
  sessionLoading,
  onChangeEmail,
  onClearEmail,
  onBlurEmail,
  onKeyDown,
  onGuestContinue,
}: ContactSectionProps) {
  return (
    <div className="chp-section">
      <div className="chp-section-header">
        <h2 className="chp-section-title">연락처</h2>
      </div>
      <TextField
        type="email"
        label="이메일 주소"
        value={email}
        onChange={onChangeEmail}
        onClear={onClearEmail}
        onBlur={onBlurEmail}
        onKeyDown={onKeyDown}
        error={emailError}
        helper="이메일 주소를 입력하세요."
      />
      {!isFormRevealed && !isLoggedIn && !sessionLoading && (
        <>
          <Link href="/login?from=checkout" className="chp-login-primary-btn" data-gtr-tap>
            로그인하고 주문하기
          </Link>
          <p className="chp-login-benefit">로그인하면 배송지 정보가 자동으로 채워집니다.</p>
          <div className="chp-guest-link-wrap">
            <button className="text-link text-link--subtle" type="button" onClick={onGuestContinue}>
              비회원으로 주문하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
