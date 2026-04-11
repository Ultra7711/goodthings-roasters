/* ══════════════════════════════════════════
   ProductDetailBody — RP-4d
   ──────────────────────────────────────────
   상품 상세 설명 + 스펙 블록.
   - desc: 두 번의 개행(\n\n) 기준으로 문단 분리, 문단 내 \n 은 <br>
   - specs: '·' 구분자로 쪼개 각 항목을 <p> 로 표시
   ══════════════════════════════════════════ */

type Props = {
  desc: string;
  specs: string;
};

export default function ProductDetailBody({ desc, specs }: Props) {
  const paragraphs = desc.trim().split(/\n\n+/).filter(Boolean);
  const specLines = specs.split('·').map((s) => s.trim()).filter(Boolean);

  return (
    <div id="pd-detail-body">
      <div id="pd-detail-text">
        {paragraphs.map((para, i) => (
          <p key={i}>
            {para.split('\n').map((line, j, arr) => (
              <span key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </div>
      {specLines.length > 0 && (
        <div id="pd-detail-specs">
          {specLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
