/* ══════════════════════════════════════════
   GuestPasswordSection — 비회원 주문조회 비밀번호
   pw + pw2 (pw 길이 충족 시 활성화).
   ══════════════════════════════════════════ */

'use client';

import type { KeyboardEvent } from 'react';
import { TextField } from '@/components/ui/TextField';
import { GUEST_PASSWORD_MIN_LENGTH } from '@/lib/validation';

type InputNavHandler = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;

type GuestPasswordSectionProps = {
  pw: string;
  pw2: string;
  pwError?: string;
  pw2Error?: string;
  showPw2: boolean;
  onChangePw: (v: string) => void;
  onClearPw: () => void;
  onChangePw2: (v: string) => void;
  onClearPw2: () => void;
  onKeyDown: InputNavHandler;
};

export default function GuestPasswordSection({
  pw,
  pw2,
  pwError,
  pw2Error,
  showPw2,
  onChangePw,
  onClearPw,
  onChangePw2,
  onClearPw2,
  onKeyDown,
}: GuestPasswordSectionProps) {
  return (
    <div className="chp-section chp-section--no-border chp-section--guest">
      <h2 className="chp-section-title">비회원 주문조회 비밀번호</h2>
      <p className="chp-section-desc">비회원 주문 조회 시 주문번호와 입력하신 비밀번호가 필요합니다.</p>
      <TextField
        type="password"
        label="비밀번호"
        value={pw}
        onChange={onChangePw}
        onClear={onClearPw}
        onKeyDown={onKeyDown}
        showPasswordToggle
        autoComplete="new-password"
        error={pwError}
        helper={`${GUEST_PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`}
      />
      <TextField
        type="password"
        label="비밀번호 확인"
        disabled={!showPw2}
        value={pw2}
        onChange={onChangePw2}
        onClear={onClearPw2}
        onKeyDown={onKeyDown}
        showPasswordToggle
        autoComplete="new-password"
        error={pw2Error}
        helper="비밀번호를 한 번 더 입력하세요."
        wrapperClass={`pw2-field${showPw2 ? ' pw2-visible' : ''}`}
      />
    </div>
  );
}
