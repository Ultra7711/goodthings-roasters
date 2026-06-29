/* ══════════════════════════════════════════
   CartSkeleton — /cart useCartQuery isLoading fallback (BUG-159 · S94)

   S202: OrderItemRow (.oir) 구조로 마이그레이션. 글로벌 .cp-item* / .cp-th* /
   .cp-table-hdr / .cp-qty / .cp-remove 의존 제거.
   S343: 중입자 통일 — editable variant 골격에서 썸네일 + 이름 + 가격(3조각)만
   채움. 카테고리·메타·스텝퍼·삭제 미세요소 생략. .oir 높이는 썸네일(112px)이
   지배하므로 입자도 축소에도 CLS 0.

   shipping / footer 영역은 CartClient 와 동일한 .cp-shipping-row · .cp-skel-footer
   잔존 클래스 사용 (이번 정리 범위 밖).
   ══════════════════════════════════════════ */

const SKELETON_ITEM_COUNT = 2;

function SkeletonItem() {
  return (
    <div className="oir" data-variant="editable">
      {/* 썸네일 통박스 — .oir 높이(112px · align-items:center)를 지배.
          내부 입자도를 줄여도 행 높이 불변 → CLS 0. */}
      <div className="oir__thumb">
        <div className="skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      </div>

      {/* Info — 이름 1줄 (중입자: 카테고리·메타·스텝퍼 미세요소 생략) */}
      <div className="oir__info">
        <div className="oir__name">
          <div className="skel" style={{ height: 18, width: 160 }} />
        </div>
      </div>

      {/* Right — 가격 1줄 (삭제 아이콘 생략 · min-height 80 유지로 행 높이 보존) */}
      <div className="oir__right">
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
