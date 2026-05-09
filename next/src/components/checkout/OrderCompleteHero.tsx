/* ══════════════════════════════════════════
   OrderCompleteHero — 자문 D §2 Hero zone (S200 PR-B)

   좌측 정렬 wider editorial. max-width 1440 + 좌우 padding 60.
   - eyebrow ORDER COMPLETE (gold 11 caps 0.18em)
   - H1 한국어 (56 / 300 / -0.025em, 반응형: 데스크탑 1줄 / 모바일 2줄)
   - 본문 1줄 (이메일 안내, 17 / 1.65 / max-width 540)
   - 메타 inline (주문번호 mono 18 + 복사 버튼)

   예상 도착 데이터(`expectedDelivery`) 는 carry-over — 현 LastOrder 미보유.
   ══════════════════════════════════════════ */

'use client';

import './OrderCompleteHero.css';
import { CopyIcon } from '@/components/ui/Icons';

type Props = {
  orderNumber: string;
  onCopy: () => void;
};

export default function OrderCompleteHero({ orderNumber, onCopy }: Props) {
  return (
    <header className="oc-hero">
      <p className="oc-hero-eyebrow">ORDER COMPLETE</p>
      <h1 className="oc-hero-title">
        주문해 주셔서<br className="oc-hero-title-br" /> 감사합니다.
      </h1>
      <p className="oc-hero-body">
        주문 확인 이메일을 발송해 드렸습니다.
        <br />
        메일이 보이지 않으면 스팸함을 확인해 주세요.
      </p>
      <div className="oc-hero-meta">
        <div className="oc-hero-meta-block">
          <span className="oc-hero-meta-lab">주문번호</span>
          <div className="oc-hero-meta-value-row">
            <span
              className="oc-hero-meta-val"
              onClick={onCopy}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCopy();
                }
              }}
            >
              {orderNumber}
            </span>
            <button
              type="button"
              className="oc-hero-meta-copy"
              title="주문번호 복사"
              aria-label="주문번호 복사"
              onClick={onCopy}
            >
              <CopyIcon />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
