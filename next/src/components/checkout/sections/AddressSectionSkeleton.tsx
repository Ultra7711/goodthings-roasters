/* ══════════════════════════════════════════
   AddressSectionSkeleton — 로그인 사용자 기본 배송지 fetch 중 표시 (S210)

   목적:
   로그인 사용자가 결제 페이지 진입 시 useDefaultAddressQuery 가 settle 할
   때까지 ContactSection 만 보이고 AddressSection 영역이 비어있어 "결제 페이지
   로딩 지연" 으로 체감됨. fetch 대기 동안 form 골격 표시로 사용자 인식 개선.

   조건 (CheckoutPage 가드):
   `isLoggedIn && addressLoading && !isFormRevealed`

   구조 정합:
   - AddressSection 실제 구조 답습 (받는 분 / 전화 / 주소+우편 가로 / 배송 메시지)
   - .chp-section--no-border 동일 (위쪽 padding 0 — ContactSection 과 spacing 통일)
   - .skel 정적 gradient (S199 V2 §1.5 shimmer 금지)
   ══════════════════════════════════════════ */

export default function AddressSectionSkeleton() {
  return (
    <div className="chp-section chp-section--no-border" aria-busy="true" aria-live="polite">
      <h2 className="chp-section-title">배송지</h2>
      <div className="chp-skel-field skel" />
      <div className="chp-skel-field skel" />
      <div className="chp-skel-addr">
        <div className="chp-skel-field skel" />
        <div className="chp-skel-field skel" />
      </div>
      <div className="chp-skel-field skel" />
    </div>
  );
}
