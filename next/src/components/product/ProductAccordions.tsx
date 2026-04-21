/* ══════════════════════════════════════════
   ProductAccordions — RP-4d
   ──────────────────────────────────────────
   - 배송 안내 / 교환·반품 안내 (모든 상품)
   - 제품 안내 (Drip Bag 전용)

   모든 아코디언은 독립 open 상태 (멀티 오픈 허용).
   상품 변경 시 모두 닫힌 초기 상태로 리셋.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';

type AccordionKey = 'shipping' | 'return' | 'product-info';

type Props = {
  category: Product['category'];
  slug: string;
};

function AccordionIcon() {
  return (
    <span className="pd-accordion-icon">
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path className="pd-icon-h" d="M5 12h14" />
        <path className="pd-icon-v" d="M12 5v14" />
      </svg>
    </span>
  );
}

export default function ProductAccordions({ category, slug }: Props) {
  const [openSet, setOpenSet] = useState<Set<AccordionKey>>(new Set());

  /* 상품 변경 시 전체 닫기 — prop(slug) 기반 동기화 의도의 setState-in-effect. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenSet(new Set());
  }, [slug]);

  const toggle = (key: AccordionKey) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isOpen = (key: AccordionKey) => openSet.has(key);
  const isDripBag = category === 'Drip Bag';

  return (
    <div id="pd-accordions">
      {/* 배송 안내 */}
      <div className={`pd-accordion${isOpen('shipping') ? ' open' : ''}`}>
        <button type="button" className="pd-accordion-hd" onClick={() => toggle('shipping')}>
          <span className="pd-accordion-label">배송 안내</span>
          <AccordionIcon />
        </button>
        <div className="pd-accordion-body">
          <p><strong>평일 오후 2시 이전 주문 시 당일 발송</strong></p>
          <br />
          <p><strong>[ 국내 배송 안내 ]</strong></p>
          <p>기본 배송비 3,000원 / 15,000원 이상 구매 시 무료 배송</p>
          <p>주문 후 평균 1–3 영업일 이내 출고됩니다.</p>
          <p>토·일·공휴일은 발송이 이루어지지 않으며, 다음 영업일에 순차 발송됩니다.</p>
          <br />
          <p>문의사항은 언제든지 편하게 연락해 주세요.</p>
        </div>
      </div>

      {/* 교환 · 반품 안내 */}
      <div className={`pd-accordion${isOpen('return') ? ' open' : ''}`}>
        <button type="button" className="pd-accordion-hd" onClick={() => toggle('return')}>
          <span className="pd-accordion-label">교환 · 반품 안내</span>
          <AccordionIcon />
        </button>
        <div className="pd-accordion-body">
          <p>원두 특성상 개봉 후에는 교환 및 반품이 불가합니다.</p>
          <p>상품 불량 또는 오배송의 경우 수령일로부터 7일 이내 연락 주시면 처리해 드립니다.</p>
          <p>단순 변심에 의한 반품은 미개봉 상태에서만 가능하며, 왕복 배송비는 고객 부담입니다.</p>
        </div>
      </div>

      {/* 제품 안내 — Drip Bag 전용 */}
      {isDripBag && (
        <div className={`pd-accordion${isOpen('product-info') ? ' open' : ''}`}>
          <button type="button" className="pd-accordion-hd" onClick={() => toggle('product-info')}>
            <span className="pd-accordion-label">제품 안내</span>
            <AccordionIcon />
          </button>
          <div className="pd-accordion-body pd-product-info-body">
            <table className="pd-info-table">
              <tbody>
                {/* 4컬럼 쌍 — 데스크탑에서 나란히, 모바일에서 2행으로 자동 분리 */}
                <tr>
                  <td className="pd-info-label">제품명</td><td>굳띵즈 드립백</td>
                  <td className="pd-info-label">내용량</td><td>12g × 10개</td>
                </tr>
                <tr>
                  <td className="pd-info-label">식품유형</td><td>커피</td>
                  <td className="pd-info-label">소비기한</td><td>별도표기일까지</td>
                </tr>
                {/* 전폭 행 — 값이 긴 항목 */}
                <tr>
                  <td className="pd-info-label">원재료 및 함량</td>
                  <td colSpan={3}>커피 100%</td>
                </tr>
                <tr>
                  <td className="pd-info-label">제조원</td>
                  <td colSpan={3}>(주)케이코닉 | 경기도 하남시 하남대로 990 B105~B107</td>
                </tr>
                <tr>
                  <td className="pd-info-label">판매원</td>
                  <td colSpan={3}>(주)브이티이코프 | 경북 구미시 인동21길 22-11 1층</td>
                </tr>
                <tr>
                  <td className="pd-info-label">포장재질</td>
                  <td colSpan={3}>여과지:폴리프로필렌 / 캡(알):폴리에틸렌 / 캐리어링 내포장:폴리에틸렌</td>
                </tr>
                {/* 4컬럼 쌍 */}
                <tr>
                  <td className="pd-info-label">포장방법</td><td>질소충진</td>
                  <td className="pd-info-label">품목보고번호</td><td>20170120209-470</td>
                </tr>
                <tr>
                  <td className="pd-info-label">반품 및 교환</td><td>구입처</td>
                  <td className="pd-info-label">보관방법</td><td>서늘한 곳에 밀봉보관</td>
                </tr>
                <tr>
                  <td className="pd-info-label">소비자상담</td><td colSpan={3}>054-451-4568</td>
                </tr>
                {/* 안내 문구 */}
                <tr>
                  <td colSpan={4} className="pd-info-note">
                    * 부정·불량식품 신고는 국번없이 1399
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
