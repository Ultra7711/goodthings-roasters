/* ══════════════════════════════════════════════════════════════════════════
   OverscrollAnchor — footer 없는 페이지의 흐름끝 색 anchor (S298)

   iOS 26 Safari 는 rubber-band(overscroll) 색을 결정할 때 body inline bg 가 아니라
   viewport edge 의 실제 DOM 요소 background-color 를 sample 한다. footer 가 있는
   페이지는 OverscrollColor 가 footer 요소를 sample(footerBg)해 정상이지만, footer 를
   숨긴 페이지(cart · PDP · order-complete)는 흐름끝 실제 요소가 없어 rubber-band 가
   white 로 나온다 (S286~S298 장기 회귀의 근본 원인).

   이 anchor 가 흐름끝(non-fixed) <footer> 로서 OverscrollColor 의 footerBg sample
   대상이 되어 색 처리를 활성화한다. position:fixed 가 아니므로 화면에 떠있지 않고
   스크롤 끝에서만 노출되며, page 배경과 동일 색이라 시각상 보이지 않는다.

   상단 rubber-band 는 OverscrollColor 의 scrollY<0 분기가 top color 로 처리한다. */
export default function OverscrollAnchor({ color = '#FBF8F3' }: { color?: string }) {
  return <footer aria-hidden="true" data-overscroll-footer style={{ backgroundColor: color, height: 1 }} />;
}
