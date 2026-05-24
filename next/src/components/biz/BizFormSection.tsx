/* ══════════════════════════════════════════
   BizFormSection — 라벨 + 필드 그룹 wrapper (S264-C 분리)
   원본: BizInquiryPage.tsx 의 인라인 FormSection.
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';

export function BizFormSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="bi-form-section">
      <div className="bi-section-label">{label}</div>
      <div className="bi-section-fields">{children}</div>
    </div>
  );
}
