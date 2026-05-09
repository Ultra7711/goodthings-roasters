/* ══════════════════════════════════════════
   CartSkeleton — /cart useCartQuery isLoading fallback (BUG-159 · S94)

   S202: OrderItemRow (.oir) 구조로 마이그레이션. 글로벌 .cp-item* / .cp-th* /
   .cp-table-hdr / .cp-qty / .cp-remove 의존 제거. CartClient 와 동일하게
   editable variant 골격(thumb · info · stepper · right(delete + price))로 채움.

   shipping / footer 영역은 CartClient 와 동일한 .cp-shipping-row · .cp-skel-footer
   잔존 클래스 사용 (이번 정리 범위 밖).
   ══════════════════════════════════════════ */

const SKELETON_ITEM_COUNT = 2;

function SkeletonItem() {
  return (
    <div className="oir" data-variant="editable">
      {/* Thumb 74×112 (모바일 72×108) — .skel 이 inset:0 으로 채움 */}
      <div className="oir__thumb">
        <div className="skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      </div>

      {/* Info column */}
      <div className="oir__info">
        {/* category eyebrow — body-s 13 × lh1 */}
        <div className="oir__category">
          <div className="skel" style={{ height: 13, width: 60 }} />
        </div>
        {/* name — body-l ≈18 × lh1.4 */}
        <div className="oir__name">
          <div className="skel" style={{ height: 18, width: 160 }} />
        </div>
        {/* meta — body-ui 14 × lh1.4 */}
        <div className="oir__meta">
          <div className="skel" style={{ height: 14, width: 110 }} />
        </div>
        {/* stepper 104×36 */}
        <div className="oir__stepper">
          <div className="skel" style={{ height: 36, width: 104, borderRadius: 0 }} />
        </div>
      </div>

      {/* Right column — delete top / price bottom */}
      <div className="oir__right">
        <div className="skel" style={{ height: 16, width: 16 }} />
        <div className="skel" style={{ height: 16, width: 70 }} />
      </div>
    </div>
  );
}

export default function CartSkeleton() {
  return (
    <div className="cp-root cp-anim">
      {/* 페이지 타이틀 */}
      <div className="cp-page-header">
        <div className="skel" style={{ height: 36, width: 160 }} />
      </div>

      {/* 아이템 리스트 (table header 없음 — OrderItemRow 구조) */}
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
          <div className="skel" style={{ height: 14, width: 90 }} />
          <div className="skel" style={{ height: 28, width: 130 }} />
        </div>
        <div className="skel cp-skel-footer-btn" />
      </div>
    </div>
  );
}
