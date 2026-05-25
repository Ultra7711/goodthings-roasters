/* ══════════════════════════════════════════
   ToggleIcon — 마이페이지 아코디언 공통 toggle 아이콘 (S283)

   닫힌 상태 = chevron-right (▶) · 열린 상태 = X (close).
   정기배송 (SubscriptionItem) 의 mp-sub-toggle-chevron / close 패턴 일반화 →
   OrderHistory + AddressSection + PasswordChangeForm 4 컴포넌트 통일.

   wrap span 자체에 .open class 토글 → CSS 가 opacity + rotate 전환.
   ════════════════════════════════════════ */

import type { ReactElement } from 'react';

type Props = {
  open?: boolean;
};

export default function ToggleIcon({ open = false }: Props): ReactElement {
  return (
    <span className={`mp-toggle-icon${open ? ' open' : ''}`} aria-hidden="true">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="mp-toggle-chevron" d="M9 6l6 6-6 6" />
        <path className="mp-toggle-close" d="M6 6l12 12M18 6L6 18" />
      </svg>
    </span>
  );
}
