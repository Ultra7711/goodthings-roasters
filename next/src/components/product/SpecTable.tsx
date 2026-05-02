/* ══════════════════════════════════════════
   SpecTable — PDP 식약처 표
   ──────────────────────────────────────────
   - dl + CSS Grid (label · value · label · value)
   - 데스크탑 4-col / 모바일 2-col 자동 변환
   - row wrapper 는 display: contents (grid 자동 흐름 유지)
   - full row 는 grid-column 명시로 전폭 차지
   - footer: 좌(notices: 부정신고 + 공정거래) / 우(certifications) 좌우 분할
   ══════════════════════════════════════════ */

import Image from 'next/image';

type SpecRow = {
  label: string;
  value: string;
  full?: boolean;
};

type CertId = 'haccp' | 'vinyl_other';

const CERT_META: Record<CertId, { src: string; alt: string }> = {
  haccp: { src: '/images/cert/haccp.svg', alt: '안전관리인증 HACCP' },
  vinyl_other: { src: '/images/cert/vinyl_other.svg', alt: '분리배출 OTHER' },
};

type SpecFooter = {
  notices?: ReadonlyArray<string>;
  certifications?: ReadonlyArray<CertId>;
};

type Props = {
  rows: ReadonlyArray<SpecRow>;
  footer?: SpecFooter;
};

export default function SpecTable({ rows, footer }: Props) {
  const hasFooter =
    footer && ((footer.notices?.length ?? 0) > 0 || (footer.certifications?.length ?? 0) > 0);

  return (
    <div className="spec-table">
      <dl className={`spec-table-grid${hasFooter ? ' spec-table-grid--has-footer' : ''}`}>
        {rows.map((row) => (
          <div
            key={row.label}
            className={`spec-row${row.full ? ' spec-row--full' : ''}`}
          >
            <dt className="spec-label">{row.label}</dt>
            <dd className="spec-value">{row.value}</dd>
          </div>
        ))}
      </dl>

      {hasFooter && (
        <div className="spec-footer">
          <div className="spec-footer-notices">
            {footer!.notices?.map((text) => (
              <p key={text} className="spec-footer-notice">
                {text}
              </p>
            ))}
          </div>
          {footer!.certifications && footer!.certifications.length > 0 && (
            <ul className="spec-footer-cert" aria-label="제품 인증 마크">
              {footer!.certifications.map((id) => (
                <li key={id} className="spec-footer-cert-item">
                  <Image
                    src={CERT_META[id].src}
                    alt={CERT_META[id].alt}
                    width={56}
                    height={56}
                    unoptimized
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
