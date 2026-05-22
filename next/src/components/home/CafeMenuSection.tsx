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
import { fetchCafeMenu } from '@/lib/cafeMenuServer';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';
import type { CafeMenuItem } from '@/lib/cafeMenu';
import galleryBlur from '@/lib/gallery-blur.json';
import MenuName from '@/components/cafe/MenuName';
import EventBanner from './EventBanner';
import MenuTab from './MenuTab';

const cafeWebpMeta = (galleryBlur as Record<string, { blurDataURL: string }>)['cafe.webp'];

/**
 * 메인 노출 카페 메뉴 3종 결정.
 * - S248 (069): site_settings.home_featured.menu_ids 가 우선 (운영자 명시 선택).
 * - DEC-S248-8 안전망: 빈 배열이거나 ids 가 cafeItems 에 없는 경우 기존
 *   `status='시그니처' .slice(0,3)` fallback.
 */
function pickFeatured(
  cafeItems: ReadonlyArray<CafeMenuItem>,
  menuIds: ReadonlyArray<string>,
): CafeMenuItem[] {
  if (menuIds.length > 0) {
    const byId = new Map(cafeItems.map((i) => [i.id, i]));
    const picked = menuIds
      .map((id) => byId.get(id))
      .filter((m): m is CafeMenuItem => m !== undefined);
    if (picked.length > 0) return picked;
  }
  return cafeItems.filter((i) => i.status === '시그니처').slice(0, 3);
}

export default async function CafeMenuSection() {
  /* 059 overlay 재설계 — eyebrow/h4 등 텍스트는 운영자 CSS 가 처리.
       Active 또는 7일 내 Coming → 동일 EventBanner 렌더 (이미지 + custom CSS).
       비활성 → EventBanner 미렌더. */
  const [activeEvent, cafeItems, siteSettings] = await Promise.all([
    getActiveCafeEvent(),
    fetchCafeMenu(),
    fetchSiteSettings(),
  ]);
  const FEATURED_ITEMS = pickFeatured(cafeItems, siteSettings.home_featured.menu_ids);
  const comingEvent = activeEvent ? null : await getComingCafeEvent();
  const displayEvent = activeEvent ?? comingEvent;

  return (
    <section className="blk cafe-menu-blk" id="cafe-menu-blk" data-header-theme="light">
      {/* chapter head */}
      <div className="cafe-menu-head" data-sr>
        <span className="blk-label sr-txt sr-txt--d1" data-sr-eyebrow>
          CAFE MENU
        </span>
        <h2 className="cafe-menu-h2 sr-txt sr-txt--d2">오늘, 매장에서</h2>
        <p className="cafe-menu-desc sr-txt sr-txt--d3">
          원두를 마시는 또 다른 방법. 매장 한정 메뉴와 시즌 음료를 만나보세요.
        </p>
      </div>

      {/* 이벤트 배너 row — active 또는 7일 내 Coming · 운영자 이미지+CSS */}
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
                {/* S248-2g: 메인 3종은 status 라벨 유지 (시그니처 포함) — 메뉴명 ✦ + 라벨 텍스트 병기.
                    /menu 카드와 달리 메인은 다른 status 와의 그리드 비교 컨텍스트 부재로
                    "시그니처" 텍스트가 노이즈가 아니라 정보 보강으로 작동. 사용자 결정. */}
                {item.status && <span className="cmsplit-status">{item.status}</span>}
                <span className="cmsplit-name">
                  <MenuName item={item} iconSize={18} />
                </span>
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
