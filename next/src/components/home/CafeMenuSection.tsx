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

import Image from 'next/image';
import Link from 'next/link';
import { getActiveCafeEvent, getComingCafeEvent } from '@/lib/cafeEventsServer';
import { composeEventEyebrow } from '@/lib/cafeEvents';
import { fetchCafeMenu } from '@/lib/cafeMenuServer';
import galleryBlur from '@/lib/gallery-blur.json';
import EventBanner from './EventBanner';
import MenuTab from './MenuTab';

const cafeWebpMeta = (galleryBlur as Record<string, { blurDataURL: string }>)['cafe.webp'];

export default async function CafeMenuSection() {
  /* PR-1d — 3 분기 렌더:
       Active   → DB eyebrow 그대로 (어드민 manual 입력 존중)
       Coming   → composeEventEyebrow 로 "Coming · MM/DD~" override
       비활성    → EventBanner 미렌더 */
  const [activeEvent, cafeItems] = await Promise.all([
    getActiveCafeEvent(),
    fetchCafeMenu(),
  ]);
  const FEATURED_ITEMS = cafeItems.filter((i) => i.status === '시그니처').slice(0, 3);
  const comingEvent = activeEvent ? null : await getComingCafeEvent();
  const event = activeEvent ?? comingEvent;
  const isComing = !!comingEvent && !activeEvent;
  const displayEvent = event && isComing
    ? { ...event, eyebrow: composeEventEyebrow(event, { isComing: true }) }
    : event;

  return (
    <section className="blk cafe-menu-blk" id="cafe-menu-blk" data-header-theme="light">
      {/* chapter head */}
      <div className="cafe-menu-head" data-sr-toggle>
        <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>
          CAFE MENU
        </span>
        <h2 className="cafe-menu-h2 sr-txt sr-txt--d2">오늘, 매장에서</h2>
        <p className="cafe-menu-desc sr-txt sr-txt--d3">
          원두를 마시는 또 다른 방법. 매장 한정 메뉴와 시즌 음료를 만나보세요.
        </p>
      </div>

      {/* 이벤트 배너 row — active 또는 7일 내 Coming (eyebrow override) */}
      {displayEvent && <EventBanner event={displayEvent} />}

      {/* PR-1c — 매장 사진 + 시그니처 메뉴 3종
          썸네일 사진 세로 가득 / 사진 내부 MENU 세로탭 (스크롤 좌상→우하 이동) */}
      <div className="cafe-menu-split">
        <div className="cafe-menu-split__photo">
          <Image
            src="/images/gallery/cafe.webp"
            alt="굳띵즈 인의동 1호점 매장 내부"
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 640px"
            style={{ objectFit: 'cover' }}
            placeholder={cafeWebpMeta ? 'blur' : 'empty'}
            blurDataURL={cafeWebpMeta?.blurDataURL}
          />
          {/* S152 — 사진 전체 클릭 시 /menu 이동 (태블릿/모바일 MenuTab 숨김 시 진입 보장) */}
          <Link
            href="/menu"
            className="cmsplit-photo-link"
            aria-label="전체 메뉴 보기"
          />
          <MenuTab />
        </div>
        <div className="cafe-menu-split__items">
          {FEATURED_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={`/menu?item=${encodeURIComponent(item.id)}`}
              className="cmsplit-row"
            >
              <div className="cmsplit-thumb">
                <Image
                  src={item.img}
                  alt={item.name}
                  fill
                  sizes="(max-width: 767px) 100px, (max-width: 1023px) 200px, 250px"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="cmsplit-info">
                {item.status && <span className="cmsplit-status">{item.status}</span>}
                <span className="cmsplit-name">{item.name}</span>
                {item.menuDesc && (
                  <p className="cmsplit-desc">{item.menuDesc}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
