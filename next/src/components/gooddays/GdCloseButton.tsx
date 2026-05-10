/* ══════════════════════════════════════════
   GdCloseButton — yet-another-react-lightbox 의 buttonClose render 컴포넌트.
   S123: controlsHidden prop 폐기. 컨트롤 일괄 hide 는 Lightbox root 의
   .gd-controls-hidden 클래스 + .yarl__toolbar fade 로 처리.
   ══════════════════════════════════════════ */

'use client';

import { useController } from 'yet-another-react-lightbox';
import { CloseIcon } from '@/components/ui/Icons';

export default function GdCloseButton() {
  const { close } = useController();
  return (
    <button
      type="button"
      className="yarl__button gd-close-btn"
      onClick={close}
      aria-label="Close"
    >
      <CloseIcon size={28} strokeWidth={1.5} />
    </button>
  );
}
