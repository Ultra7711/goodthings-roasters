/* ══════════════════════════════════════════
   emphasizeHours
   영업시간·오픈 상태 텍스트의 핵심 정보(시간·휴무) 강조.
   - 시간 토큰  `\d{1,2}:\d{2}` → .emph-time (weight 600 + text-primary)
   - "휴무"     → .emph-closed (weight 600 + error red)
   ══════════════════════════════════════════ */

import React from 'react';

const PATTERN = /(\d{1,2}:\d{2}|휴무)/g;

export function emphasizeHours(text: string): React.ReactNode[] {
  const parts = text.split(PATTERN);
  return parts.map((part, i) => {
    if (/^\d{1,2}:\d{2}$/.test(part)) {
      return (
        <strong key={i} className="emph-time">
          {part}
        </strong>
      );
    }
    if (part === '휴무') {
      return (
        <strong key={i} className="emph-closed">
          {part}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
