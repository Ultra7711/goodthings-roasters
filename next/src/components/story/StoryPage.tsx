/* ══════════════════════════════════════════
   StoryPage — /story
   프로토타입 #story-page (L4092~4175 + L4907~5078 + L10552~10622) 이식.

   설계 결정:
   1. 진입 연출
      - 히어로 EN/KR 순차 페이드: 200ms / 450ms (프로토타입 _initStoryAnimate)
      - 본문 sr-txt/sr-img: 페이지 스코프 IO + threshold 0.3 + rootMargin '0px 0px -40px 0px'
      - 토글 동작(viewport 이탈 시 클래스 제거) — 프로토타입 그대로
      - 동일 라우트 헤더 재클릭 시 진입 연출 재트리거 (samepage_reentry_animation 패턴)

   2. SR 시스템
      - 레이아웃 SRInitializer 는 one-shot 이라 토글 동작과 충돌함 → Story 페이지는
        [data-sr-story] 마커로 분리. SRInitializer 는 [data-sr]:not([data-sr-story])
        만 잡고, Story 페이지 전용 IO 는 [data-sr-story] 만 잡는다(2026-04-12 충돌 수정).
        프리뷰 검증 결과 두 IO 가 동일 요소를 동시에 보면 i=1 케이스에서 one-shot 의
        add 가 토글의 remove 를 이기는 race 발생 — attribute 분리로 해소.

   3. Location 해시(`/story#location`)
      - footer 링크 호환 — `<section id="location">` 로 노출.
      - sticky 헤더 96px 만큼 scroll-margin-top 으로 보정.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  STORY_HERO,
  STORY_LOCATION,
  STORY_PROMISE,
  STORY_TWO_COL,
  type StoryTwoColItem,
} from '@/lib/story';
import KakaoMap from './KakaoMap';
import { emphasizeHours } from '@/lib/emphasizeHours';

/* 본문 \n\n → <br><br> 단락 분리 */
function paragraphs(body: string) {
  return body.split('\n\n');
}

export default function StoryPage() {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const heroEnRef = useRef<HTMLHeadingElement | null>(null);
  const heroKrRef = useRef<HTMLParagraphElement | null>(null);
  /* 재진입·same-path 재클릭마다 히어로 페이드 + IO 재구성을 재생하기 위한 카운터.
     - 'gtr:route-change' (layout 발송, 다른 페이지 → /story 복귀)
     - 'gtr:story-reset' (SiteHeader same-path 재클릭)
     둘 다 setResetTick 증가 → effect 재실행. */
  const [resetTick, setResetTick] = useState(0);

  /* same-page reentry — SiteHeader The Story 링크 재클릭 시 발송.
     스크롤 top + resetTick 증가 → 히어로 페이드 + sr-txt 리빌 재생.
     Menu/Shop 과 동일한 same-page reentry 정책. */
  useEffect(() => {
    function onReset() {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setResetTick((n) => n + 1);
    }
    window.addEventListener('gtr:story-reset', onReset);
    return () => window.removeEventListener('gtr:story-reset', onReset);
  }, []);

  /* route-change (다른 페이지 → /story 복귀) — Layout 의 NavigationVisibilityGate
     가 발송하는 'gtr:route-change' 를 수신해 detail === '/story' 에서 resetTick 증가.
     Next.js 16 + React 19 Activity 하에서 이 페이지는 display:none 으로 hidden +
     effect 가 defer 되어 pathname/resetTick deps 만으로는 재진입 감지 불가. Layout
     은 Activity 밖이라 해당 event 는 항상 발송됨. (DB-10 S72 측정 기반) */
  useEffect(() => {
    function onRouteChange(e: Event) {
      if ((e as CustomEvent<string>).detail !== '/story') return;
      setResetTick((n) => n + 1);
    }
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, []);

  /* 히어로 순차 페이드 — 프로토타입 _initStoryAnimate 의 200ms / 450ms 타이밍.
     state → DOM ref 방식 (Menu/Shop 패턴 통일): class 를 직접 remove/reflow/add 하여
     CSS keyframes (gtr-rise-20) 재생을 안정적으로 트리거. React state 기반은 Activity
     하에서 batch 처리로 false→true 전환이 같은 commit 에 묶여 재생 실패 위험 있음. */
  useEffect(() => {
    const en = heroEnRef.current;
    const kr = heroKrRef.current;
    if (!en || !kr) return;
    en.classList.remove('st--visible');
    kr.classList.remove('st--visible');
    void en.offsetHeight;
    void kr.offsetHeight;
    const t1 = window.setTimeout(() => en.classList.add('st--visible'), 200);
    const t2 = window.setTimeout(() => kr.classList.add('st--visible'), 450);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [resetTick]);

  /* 페이지 스코프 sr-txt/sr-img Intersection Observer.
     - threshold 0.3 / rootMargin '0px 0px -40px 0px' (프로토타입 동일)
     - 토글 동작: 화면을 벗어나면 sr--visible 제거 → 다시 볼 때 재생
     - resetTick 변경 시 IO 재구성 + 모든 요소 클래스 reset
  */
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const targets = body.querySelectorAll<HTMLElement>('[data-sr-story]');
    /* reset: 이전 진입에서 남은 visibility 제거 */
    targets.forEach((el) => el.classList.remove('sr--visible'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('sr--visible');
          else e.target.classList.remove('sr--visible');
        });
      },
      { threshold: 0.3, rootMargin: '0px 0px -40px 0px' },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [resetTick]);

  return (
    <div id="st-body" ref={bodyRef}>
      {/* ── HERO ── */}
      <section className="st-hero" data-header-theme="dark">
        <div
          className="st-hero-bg"
          style={{ backgroundImage: `url('${STORY_HERO.background}')` }}
        />
        <div className="st-hero-content">
          <h1 ref={heroEnRef} className="st-hero-en">
            {STORY_HERO.en}
          </h1>
          <p ref={heroKrRef} className="st-hero-kr">
            {STORY_HERO.kr}
          </p>
        </div>
      </section>

      {/* ── COFFEE / BREWING / BAKERY ── */}
      {STORY_TWO_COL.map((item, idx) => (
        <StoryTwoColSection key={item.label} item={item} bgVariant={idx % 2 === 1 ? 'secondary' : null} />
      ))}

      {/* ── PROMISE ── */}
      <section className="st-promise blk--bg-tertiary" data-header-theme="light" data-sr-story>
        <div className="st-promise-inner">
          <span className="st-label sr-txt sr-txt--d1">{STORY_PROMISE.label}</span>
          <h2 className="st-promise-heading sr-txt sr-txt--d2">{STORY_PROMISE.heading}</h2>
          <p className="st-promise-body sr-txt sr-txt--d3">
            {STORY_PROMISE.body.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ── LOCATION ── */}
      <section
        id="location"
        className="st-location"
        data-header-theme="light"
      >
        <div className="st-location-inner">
          <div className="st-location-map" data-sr-story>
            <KakaoMap
              lat={STORY_LOCATION.lat}
              lng={STORY_LOCATION.lng}
              level={STORY_LOCATION.zoomLevel}
              title={`${STORY_LOCATION.name} 위치`}
              placeName={STORY_LOCATION.kakaoPlaceName}
              placeId={STORY_LOCATION.kakaoPlaceId}
            />
          </div>
          <div className="st-location-info" data-sr-story>
            <div>
              <span className="st-label sr-txt sr-txt--d1">{STORY_LOCATION.label}</span>
              <p className="st-location-name sr-txt sr-txt--d2">{STORY_LOCATION.name}</p>
            </div>
            <p className="st-location-notice sr-txt sr-txt--d2">{emphasizeHours(STORY_LOCATION.notice)}</p>
            <p className="st-location-hours sr-txt sr-txt--d3">
              {STORY_LOCATION.hours.split('\n').map((line, i, arr) => (
                <span key={i}>
                  {emphasizeHours(line)}
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── 좌우 교차 섹션 ── */
function StoryTwoColSection({ item, bgVariant }: { item: StoryTwoColItem; bgVariant?: 'secondary' | null }) {
  const cls = `st-two-col${item.reverse ? ' st-two-col--reverse' : ''}${bgVariant === 'secondary' ? ' blk--bg-secondary' : ''}`;
  return (
    <section className={cls} data-header-theme="light" data-sr-story>
      <div className="st-two-col-inner">
        <div className="st-col-txt">
          <span className="st-label sr-txt sr-txt--d1">{item.label}</span>
          <h2 className="st-col-heading sr-txt sr-txt--d2">{item.heading}</h2>
          <p className="st-col-body sr-txt sr-txt--d3">
            {paragraphs(item.body).map((p, i, arr) => (
              <span key={i}>
                {p}
                {i < arr.length - 1 && (
                  <>
                    <br />
                    <br />
                  </>
                )}
              </span>
            ))}
          </p>
        </div>
        <div className="st-col-img">
          <div
            className="st-img-placeholder sr-img"
            style={{ backgroundImage: `url('${item.image}')` }}
          />
        </div>
      </div>
    </section>
  );
}
