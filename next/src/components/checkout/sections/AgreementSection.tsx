/* ══════════════════════════════════════════
   AgreementSection — 약관 동의
   전체 동의 + 개별 2개 (이용약관 / 개인정보).
   ══════════════════════════════════════════ */

'use client';

import { ChevronRight } from '@/components/ui/Icons';

const AGREEMENT_LABELS = [
  '[필수] 쇼핑몰 이용약관 동의',
  '[필수] 개인정보 수집 및 이용 동의',
] as const;

function CheckboxIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5,12l5,5,9-9" />
    </svg>
  );
}

type AgreementSectionProps = {
  agreements: boolean[];
  allAgreed: boolean;
  agreementError?: string;
  onToggle: (idx: number) => void;
  onToggleAll: () => void;
};

export default function AgreementSection({
  agreements,
  allAgreed,
  agreementError,
  onToggle,
  onToggleAll,
}: AgreementSectionProps) {
  return (
    <div className={`chp-section chp-section--no-border chp-agree-section${agreementError ? ' error' : ''}`}>
      <label className="chp-agree-all-row" onClick={(e) => { e.preventDefault(); onToggleAll(); }}>
        <input type="checkbox" checked={allAgreed} readOnly />
        <span className={`chp-check-icon${allAgreed ? ' checked' : ''}`}>
          <CheckboxIcon />
        </span>
        <span className="chp-agree-all-label">모든 약관 동의</span>
      </label>
      <div className="chp-agree-items">
        {AGREEMENT_LABELS.map((label, idx) => (
          <label key={idx} className="chp-agree-item" onClick={(e) => { e.preventDefault(); onToggle(idx); }}>
            <input type="checkbox" checked={agreements[idx]} readOnly />
            <span className={`chp-check-icon${agreements[idx] ? ' checked' : ''}`}>
              <CheckboxIcon />
            </span>
            <span className="chp-agree-item-label">{label}</span>
            <span className="chp-agree-arrow" aria-hidden="true"><ChevronRight size={20} /></span>
          </label>
        ))}
      </div>
    </div>
  );
}
