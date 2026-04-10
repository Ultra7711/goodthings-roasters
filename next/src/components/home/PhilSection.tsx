/* ══════════════════════════════════════════
   PhilSection (Our Story)
   프로토타입 .phil-section (라인 879–889) 이식
   ══════════════════════════════════════════ */

import Link from 'next/link';

export default function PhilSection() {
  return (
    <section className="blk phil-section" data-header-theme="light" data-sr>
      <div className="phil">
        <div className="phil-img sr-img">
          <div className="phil-img-inner" />
        </div>
        <div className="phil-txt">
          <span className="phil-lbl sr-txt sr-txt--d1">OUR STORY</span>
          <span className="phil-h sr-txt sr-txt--d2">
            좋은 것에는<br />시간이 필요합니다.
          </span>
          <span className="phil-body sr-txt sr-txt--d3">
            빠름보다 바름을 선택합니다.<br />
            정직한 로스팅, 일관된 품질, 그리고 진심.<br />
            그것이 굳띵즈가 지켜온 단 하나의 기준입니다.
          </span>
          <Link href="/story" className="season-cta sr-txt sr-txt--d4">
            스토리 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
