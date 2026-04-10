/* ══════════════════════════════════════════
   BizToggle
   사업자 정보 토글 버튼 + 상세 인라인 패널
   f-biz-detail을 내부에 포함하여 React state로만 제어
   ══════════════════════════════════════════ */

'use client';

import { useState } from 'react';

export default function BizToggle() {
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      document.getElementById('f-biz-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  return (
    <>
      <button
        className="f-biz-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="f-biz-detail"
        onClick={toggle}
      >
        사업자 정보 {open ? '▴' : '▾'}
      </button>

      {/* flex-basis:100% (globals.css)로 f-bottom-row 다음 줄에 배치 */}
      <div className={`f-biz-inline${open ? ' open' : ''}`} id="f-biz-detail">
        주식회사 브이티이코프<span className="f-biz-sep">·</span>
        대표 김주호<span className="f-biz-sep">·</span>
        사업자 등록번호 510-81-30238<span className="f-biz-sep">·</span>
        통신판매업 신고번호 2023-경북구미-0508<span className="f-biz-sep">·</span>
        주소 경북 구미시 인동21길 22-11<span className="f-biz-sep">·</span>
        전화번호 {process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '—'}<span className="f-biz-sep">·</span>
        이메일 {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '—'}
      </div>
    </>
  );
}
