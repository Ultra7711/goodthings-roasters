/* ══════════════════════════════════════════
   CafeMenuSection — server component
   (S149 V2 §2.5 PR-1b)

   advisory-E §4 ① stacked 패턴:
     chapter head → 이벤트 row (조건부) → 메뉴 split (PR-1c)

   chapter head 카피 (advisory-E §6.2):
     eyebrow  = "Cafe · 인의동 1호점"
     h2       = "매장에서, 다른 잔"
     본문     = "원두를 마시는 또 다른 방법…"
   ══════════════════════════════════════════ */

import { getActiveCafeEvent, getComingCafeEvent } from '@/lib/cafeEventsServer';
import EventBanner from './EventBanner';

export default async function CafeMenuSection() {
  const activeEvent = await getActiveCafeEvent();
  const comingEvent = activeEvent ? null : await getComingCafeEvent();
  const event = activeEvent ?? comingEvent;

  return (
    <section className="blk cafe-menu-blk" id="cafe-menu-blk" data-header-theme="light">
      {/* chapter head */}
      <div className="cafe-menu-head" data-sr-toggle>
        <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>
          CAFE MENU
        </span>
        <h2 className="cafe-menu-h2 sr-txt sr-txt--d2">오늘, 매장에서.</h2>
        <p className="cafe-menu-desc sr-txt sr-txt--d3">
          원두를 마시는 또 다른 방법. 매장 한정 메뉴와 시즌 음료를 만나보세요.
        </p>
      </div>

      {/* 이벤트 배너 row — active 또는 7일 내 Coming */}
      {event && <EventBanner event={event} />}
    </section>
  );
}
