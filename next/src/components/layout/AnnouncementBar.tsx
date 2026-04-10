/* ══════════════════════════════════════════
   AnnouncementBar
   프로토타입 #site-ann-wrap / .ann 그대로 이식
   ══════════════════════════════════════════ */

export default function AnnouncementBar() {
  return (
    <div id="site-ann-wrap">
      <div className="ann">
        <span className="ann-kr">30,000원 이상 구매 시 무료 배송</span>
        <span className="ann-secondary">
          <span className="ann-dot">·</span>
          <span className="ann-en">Specialty Coffee For All</span>
        </span>
      </div>
    </div>
  );
}
