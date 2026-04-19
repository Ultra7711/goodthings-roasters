/* ══════════════════════════════════════════
   TwoColSection (Subscription + Business)
   프로토타입 .two-col (라인 904–929) 이식
   ══════════════════════════════════════════ */

import Link from 'next/link';

export default function TwoColSection() {
  return (
    <section className="blk blk--bg-tertiary two-col-blk" data-header-theme="light">
      <div className="two-col">
        {/* Subscription */}
        <Link href="/shop?filter=sub" className="tci" id="svc-subscription" data-sr-toggle>
          <div className="tci-img">
            <div className="tci-img-inner img-subscription" />
            <div className="tci-overlay">
              <svg
                className="tci-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5,12h14" />
                <path d="M12,5l7,7-7,7" />
              </svg>
              <div className="tci-lbl sr-txt sr-txt--d1">Subscription</div>
              <div className="tci-h sr-txt sr-txt--d2">매달, 문 앞까지.</div>
              <div className="tci-body sr-txt sr-txt--d3">엄선된 원두를 원하는 주기에 맞춰 배송합니다.</div>
            </div>
          </div>
        </Link>

        {/* Business */}
        <Link href="/biz-inquiry" className="tci" id="svc-business" data-sr-toggle>
          <div className="tci-img">
            <div className="tci-img-inner img-business" />
            <div className="tci-overlay">
              <svg
                className="tci-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5,12h14" />
                <path d="M12,5l7,7-7,7" />
              </svg>
              <div className="tci-lbl sr-txt sr-txt--d1">Business</div>
              <div className="tci-h sr-txt sr-txt--d2">좋은 원두를, 좋은 공간에.</div>
              <div className="tci-body sr-txt sr-txt--d3">카페, 레스토랑, 오피스에 맞춤 납품합니다.</div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
