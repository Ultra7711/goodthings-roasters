/* ══════════════════════════════════════════
   BizToggle
   프로토타입 .f-biz-toggle 인라인 onclick 로직 이식
   footer .f-biz-inline 의 open 클래스 토글
   ══════════════════════════════════════════ */

'use client';

import { useState } from 'react';

export default function BizToggle() {
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);

    if (next) {
      const el = document.getElementById('f-biz-detail');
      if (el) el.classList.add('open');
      /* 하단으로 스크롤 */
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 80);
    } else {
      const el = document.getElementById('f-biz-detail');
      if (el) el.classList.remove('open');
    }
  }

  return (
    <button className="f-biz-toggle" type="button" onClick={toggle}>
      사업자 정보 {open ? '▴' : '▾'}
    </button>
  );
}
