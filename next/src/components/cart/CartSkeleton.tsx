/* ══════════════════════════════════════════
   CartSkeleton — /cart useCartQuery isLoading fallback (BUG-159 · S94)

   실제 CartClient 레이아웃 치수 기준:
   - .cp-root: max-width 1440px · padding 100px 60px 120px
   - 제목: --type-h1-size (≈36px)
   - .cp-table-hdr: body-s(13px) · padding-bottom 12px · height ≈38px
   - .cp-item: height 176px (데스크탑) / grid 3행 (모바일 ≤767px)
   - .cp-item-thumb: 100×100px (데스크탑) · 96×96px (모바일)
   - .cp-item-category: body-ui 14px (mobile: 12px)
   - .cp-item-name-kr: body-l ≈17px · line-height 1.35 → 23px
   - .cp-item-price / total: heading-s 16px · width 128px
   - .cp-item-qty: 128px wide · qty buttons ≈88×40px
   - .cp-item-total: heading-s 16px · width 128px
   - .cp-footer: height 176px (데스크탑) · sticky (모바일)

   반응형 처리: .cp-item, .cp-item-product, .cp-item-info 등
   실제 CSS 클래스를 그대로 재사용 → @media 규칙 자동 적용.
   cp-root에 cp-anim 병기 → opacity:0 초기값 무력화.
   ══════════════════════════════════════════ */

const SKELETON_ITEM_COUNT = 2;

function SkeletonItem() {
  return (
    <div className="cp-item">
      <div className="cp-item-product">
        <div className="cp-item-thumb">
          {/* position:relative는 .cp-item-thumb CSS에서 처리 */}
          <div className="skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
        </div>
        <div className="cp-item-info">
          {/* 카테고리: body-ui 14px × lh1 = 14px */}
          <div className="cp-item-category">
            <div className="skel" style={{ height: 14, width: 80 }} />
          </div>
          {/* 상품명: body-l ≈17px × lh1.35 = 23px */}
          <div className="cp-item-name">
            <div className="skel" style={{ height: 23, width: 160 }} />
          </div>
        </div>
      </div>

      {/* 가격 — 128px col, heading-s 16px */}
      <span className="cp-item-price">
        <div className="skel" style={{ height: 16, width: 70, margin: '0 auto' }} />
      </span>

      {/* 수량 — 128px col · qty 버튼 영역 */}
      <div className="cp-item-qty">
        <div className="skel" style={{ height: 40, width: 88, borderRadius: 2 }} />
      </div>

      {/* 합계 — 128px col, heading-s 16px */}
      <span className="cp-item-total">
        <div className="skel" style={{ height: 16, width: 70, margin: '0 auto' }} />
      </span>

      {/* 삭제 버튼 자리 — 26px col */}
      <div className="cp-remove" aria-hidden="true" />
    </div>
  );
}

export default function CartSkeleton() {
  return (
    <div className="cp-root cp-anim">
      {/* 헤더 */}
      <div className="cp-page-header">
        <div className="skel" style={{ height: 36, width: 160 }} />
      </div>

      {/* 테이블 헤더 — desktop only (mobile: display:none via CSS) */}
      <div className="cp-table-hdr">
        <span className="cp-th-product">
          <div className="skel" style={{ height: 13, width: 30 }} />
        </span>
        <span className="cp-th-price">
          <div className="skel" style={{ height: 13, width: 30, margin: '0 auto' }} />
        </span>
        <span className="cp-th-qty">
          <div className="skel" style={{ height: 13, width: 30, margin: '0 auto' }} />
        </span>
        <span className="cp-th-total">
          <div className="skel" style={{ height: 13, width: 30, margin: '0 auto' }} />
        </span>
        <span className="cp-th-delete" />
      </div>

      {/* 아이템 */}
      <div className="cp-items-list">
        {Array.from({ length: SKELETON_ITEM_COUNT }, (_, i) => (
          <SkeletonItem key={i} />
        ))}
      </div>

      {/* 배송비 행 — height 42px (desktop) / grid 2행 (mobile) */}
      <div className="cp-shipping-row">
        <div className="cp-shipping-main">
          <span className="cp-shipping-label">
            <div className="skel" style={{ height: 14, width: 30 }} />
          </span>
          <span className="cp-shipping-notice">
            <div className="skel" style={{ height: 14, width: 200 }} />
          </span>
          <span className="cp-shipping-price">
            <div className="skel" style={{ height: 14, width: 50 }} />
          </span>
        </div>
      </div>

      {/* 푸터 — desktop: position:relative h176 / mobile: sticky */}
      <div className="cp-skel-footer">
        <div className="cp-skel-subtotal">
          {/* 결제예정금액 라벨: body-ui 14px */}
          <div className="skel" style={{ height: 14, width: 90 }} />
          {/* 금액: --type-price-l-size ≈28px */}
          <div className="skel" style={{ height: 28, width: 130 }} />
        </div>
        {/* 주문하기 버튼: height 52px */}
        <div className="skel cp-skel-footer-btn" />
      </div>
    </div>
  );
}
