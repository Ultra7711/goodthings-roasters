/* ══════════════════════════════════════════
   StoryPage — /story
   프로토타입 #story-page (L4092~4175 + L4907~5078 + L10552~10622) 이식.

   설계 결정:
   1. 진입 연출
      - 히어로 EN/KR 순차 페이드: 200ms / 450ms (프로토타입 _initStoryAnimate)
      - 본문 sr-txt/sr-img: 레이아웃 SRInitializer 단일 IO 처리 (P9 · S220).
        threshold 0.15 + rootMargin '0px 0px -20px 0px' + 1회 재생 (one-shot).
      - 동일 라우트 헤더 재클릭 시 히어로 페이드 재트리거 (samepage_reentry_animation 패턴).
        본문 sr 는 1회 재생 spec 상 same-page reentry 시 재발화하지 않음.

   2. SR 시스템 (P9 · S220 단일화)
      - 마커는 [data-sr] 로 통일. 별도 페이지 스코프 IO 제거.
      - SRInitializer 가 모든 sr 동작을 단일 IO 로 처리.

   3. Location 해시(`/story#location`)
      - footer 링크 호환 — `<section id="location">` 로 노출.
      - sticky 헤더 96px 만큼 scroll-margin-top 으로 보정.
   ══════════════════════════════════════════ */

'use client';

import './StoryPage.css';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  STORY_HERO,
  STORY_LOCATION,
  STORY_PROMISE,
  STORY_TWO_COL,
  getStoryImageMeta,
  type StoryTwoColItem,
} from '@/lib/story';
import KakaoMap from './KakaoMap';
import { emphasizeHours } from '@/lib/emphasizeHours';

/* 본문 \n\n → <br><br> 단락 분리 */
function paragraphs(body: string) {
  return body.split('\n\n');
}

export default function StoryPage() {
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

  return (
    <div id="st-body">
      {/* ── HERO ── */}
      <section className="st-hero" data-header-theme="dark">
        <div className="st-hero-bg">
          <Image
            src={STORY_HERO.background}
            alt=""
            fill
            sizes="100vw"
            priority
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            placeholder={getStoryImageMeta(STORY_HERO.background) ? 'blur' : 'empty'}
            blurDataURL={getStoryImageMeta(STORY_HERO.background)?.blurDataURL}
          />
        </div>
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
      <section className="st-promise blk--bg-tertiary" data-header-theme="light" data-sr>
        <div className="st-promise-inner">
          <span className="st-label sr-txt sr-txt--d1" data-sr-eyebrow>{STORY_PROMISE.label}</span>
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
          <div className="st-location-map" data-sr>
            <KakaoMap
              lat={STORY_LOCATION.lat}
              lng={STORY_LOCATION.lng}
              level={STORY_LOCATION.zoomLevel}
              title={`${STORY_LOCATION.name} 위치`}
              placeName={STORY_LOCATION.kakaoPlaceName}
              placeId={STORY_LOCATION.kakaoPlaceId}
            />
          </div>
          <div className="st-location-info" data-sr>
            <div>
              <span className="st-label sr-txt sr-txt--d1" data-sr-eyebrow>{STORY_LOCATION.label}</span>
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
    <section className={cls} data-header-theme="light" data-sr>
      <div className="st-two-col-inner">
        <div className="st-col-txt">
          <span className="st-label sr-txt sr-txt--d1" data-sr-eyebrow>{item.label}</span>
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
          <div className="st-img-placeholder sr-img">
            <Image
              src={item.image}
              alt={item.label}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              placeholder={getStoryImageMeta(item.image) ? 'blur' : 'empty'}
              blurDataURL={getStoryImageMeta(item.image)?.blurDataURL}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
