/* ══════════════════════════════════════════
   GdCloseButton — yet-another-react-lightbox 의 buttonClose render 컴포넌트.
   Always render + className 토글 → opacity transition 가능 (이전 conditional null 패턴은 unmount/mount 라 fade 불가).
   ══════════════════════════════════════════ */

'use client';

import { useController } from 'yet-another-react-lightbox';

type Props = { controlsHidden: boolean };

export default function GdCloseButton({ controlsHidden }: Props) {
  const { close } = useController();
  return (
    <button
      type="button"
      className={`yarl__button gd-close-btn${controlsHidden ? ' gd-close-btn--hidden' : ''}`}
      onClick={close}
      aria-label="Close"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19,5l-14,14" />
        <path d="M5,5l14,14" />
      </svg>
    </button>
  );
}
