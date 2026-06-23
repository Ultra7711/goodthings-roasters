/* ══════════════════════════════════════════
   FooterBottom
   푸터 최하단(.f-bottom-wrap) 전체를 담당하는 client component
   - .f-bottom-row 와 .f-biz-inline 을 형제로 렌더링
     → 토글 열릴 때 f-bottom-wrap 전체 세로폭이 자연스럽게 늘어남
   - 이전 BizToggle.tsx 에서 Fragment 로 2 요소를 한 부모에 렌더하고
     order:999 / flex-basis:100% CSS 해킹으로 다음 줄에 배치하던 방식은
     초기 렌더에서 flex-wrap 이 안정적으로 동작하지 않아 폐기함

   ─── 자동 스크롤 구현 노트 ───
   요구 사항: 사업자 정보 패널이 열릴 때 CSS max-height 트랜지션과
   브라우저 스크롤이 "병렬로(layout-synced)" 진행되어, 패널 하단이
   뷰포트 하단에 붙은 채 콘텐츠가 아래로 자라는 모션을 만든다.

   폐기된 접근들:
   1. setTimeout(80ms) + scrollIntoView({block:'nearest'})
      → 트랜지션 중간 측정값(짧은 노출)로 스크롤량이 과소 계산됨
   2. useEffect([open]) + scrollIntoView
      → commit 시점 max-height:0 이라 "이미 보임" 판정으로 스킵
   3. force reflow 로 자연 높이 측정 + window.scrollBy({behavior:'smooth'})
      → `scrollBy({smooth})` 는 호출 시점의 maxScrollTop 으로 target 을
        clamp. 사용자가 페이지 바닥에 있을 때 호출되면 문서가 아직 자라지
        않아 clamp 로 0 이동이 되고, 뒤늦게 CSS 가 문서를 키워도 이미
        예약된 smooth scroll 은 unclamp 되지 않음. 첫 클릭 실패의 원인.

   현재 접근: rAF 루프로 layout-synced 스크롤 (목표 정렬 방식)
   - useEffect 안에서 매 프레임 wrapper.getBoundingClientRect() 실측
   - 매 프레임 "푸터 하단을 (뷰포트 하단 - BIZ_DETAIL_BOTTOM_PADDING)에
     맞추는" delta 만큼 동기 window.scrollBy(0, delta)
   - 동기 scrollBy 는 "해당 프레임의 현재 layout" 기준으로 이동하므로
     clamp 없이 정확히 정렬
   - CSS 트랜지션과 scroll 이 layout 레벨에서 완벽 동기 → 푸터가 뷰포트
     하단에 "붙은 채" 콘텐츠가 아래로 자라는 자연스러운 모션
   - 여백(PADDING)이 루프 내내 유지되므로 종료 후 별도 smooth nudge 불필요.
     (구 growth-누적 방식은 종료 후 PADDING 만큼 smooth scrollBy 를 따로
      발사 → 모바일에서 "끝에서 멈칫 후 제자리" 모션이 매번 발생했음)
   - 성장이 멈춘 프레임이 연속 MAX_ZERO_GROWTH_FRAMES 이상이면 종료
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BUSINESS_INFO } from '@/lib/constants';

/* 공정거래위원회 통신판매 사업자정보 조회 (전자상거래법 §13 의무) */
const FTC_BIZ_LOOKUP_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_INFO.registrationNumber.replace(/-/g, '')}`;

// 루프 종료 후 패널 하단과 뷰포트 하단 사이에 유지할 여백
const BIZ_DETAIL_BOTTOM_PADDING = 16;
// 성장이 멈춘 것으로 판정할 연속 무성장 프레임 수.
// 25 프레임 ≈ 417ms @60fps 로 CSS --duration-drawer(350ms) 트랜지션 완료 후
// 추가 안정화 구간까지 커버 → 조기 종료 시 최종 nudge 가 아직 진행 중인
// 트랜지션과 충돌(smooth scroll clamp)하는 경계 시나리오를 제거한다.
const MAX_ZERO_GROWTH_FRAMES = 25;
// 안전 상한 — CSS duration 변경 등 예외 상황에서 무한 루프 방지
const MAX_SCROLL_DURATION_MS = 800;

export default function FooterBottom() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const bizRef = useRef<HTMLDivElement>(null);
  // rapid re-toggle 방어: 각 rAF 루프는 자기 token 을 소유, tokenRef 가 달라지면 즉시 종료
  const scrollTokenRef = useRef(0);
  // rAF id 를 ref 로 유지 — 클로저 stale 가능성 차단, cleanup 취소 명시성 향상
  const rafIdRef = useRef(0);
  // 라우트 전환으로 닫히는 경우(BUG-170) 닫기 스크롤을 생략하기 위한 플래그
  const skipCloseScrollRef = useRef(false);
  // 첫 마운트(초기 open=false) 의 닫기 effect 1회 스크롤 생략
  const isInitRef = useRef(true);

  // 라우트 전환 시 rAF 루프 취소 + 토글 닫기 (BUG-170)
  // FooterBottom 은 레이아웃에 위치해 언마운트되지 않으므로 open=true + rAF 루프가
  // 새 페이지에서도 계속 실행 → NavigationScrollReset 이후 최종 scrollBy 가 발사되는 버그.
  useEffect(() => {
    // route change cleanup — pathname 변경 시 open 닫기 (의도된 setState in effect)
    /* eslint-disable react-hooks/set-state-in-effect */
    cancelAnimationFrame(rafIdRef.current);
    scrollTokenRef.current++;
    skipCloseScrollRef.current = true; // 라우트 전환 닫기 = 새 페이지에서 스크롤 발사 금지
    setOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  useEffect(() => {
    // 첫 마운트(초기 open=false) — 닫기 루프 1회 생략
    if (isInitRef.current) {
      isInitRef.current = false;
      return;
    }

    // 라우트 전환으로 닫히는 경우 — 스크롤 생략 (BUG-170)
    if (!open && skipCloseScrollRef.current) {
      skipCloseScrollRef.current = false;
      return;
    }

    // prefers-reduced-motion 사용자: 자동 스크롤 완전 생략.
    // 페이지가 임의로 점프/스크롤되는 인상은 reduce motion 의도에 반하므로
    // 토글 상태 변경만 수행하고 뷰포트는 그대로 둔다.
    // (CSS max-height 트랜지션 자체의 duration 단축은 globals.css 의
    //  @media (prefers-reduced-motion: reduce) 전역 룰에서 처리)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const el = bizRef.current;
    const wrapper = el?.parentElement; // .f-bottom-wrap
    if (!wrapper) return;

    const myToken = ++scrollTokenRef.current;
    let zeroFrames = 0;
    const startTs = performance.now();

    const step = () => {
      if (scrollTokenRef.current !== myToken) return;
      const now = performance.now();
      // 강제 layout — 이 프레임의 푸터 하단 위치를 실측.
      // growth(증가분) 누적 방식 대신 매 프레임 "푸터 하단을 뷰포트 하단 - 여백"에
      // 동기 정렬한다. BIZ_DETAIL_BOTTOM_PADDING 이 루프 내내 유지되므로 트랜지션
      // 종료 후 별도 smooth nudge(= 끝에서 멈칫 후 제자리 모션)가 불필요해진다.
      const rect = wrapper.getBoundingClientRect();
      const delta = rect.bottom - window.innerHeight + BIZ_DETAIL_BOTTOM_PADDING;

      // 펼침 = 아래로(delta>0), 닫힘 = 위로(delta<0) 정렬 → 닫기는 펼침의 역재생.
      // 닫힘 시 콘텐츠가 화면 안에서 위로 접히며 사라진다 (화면 밖 "쏟아짐" 제거).
      const moved = open ? delta > 0.5 : delta < -0.5;

      if (moved) {
        // 동기 scrollBy (behavior 없음). 이 프레임의 layout 기준으로 정렬하므로
        // clamp 없이 정확히 이동 → 푸터가 뷰포트 하단에 "붙은 채" 콘텐츠가
        // 자라거나(펼침) 접히는(닫힘) 모션이 그대로 유지된다.
        window.scrollBy(0, delta);
        zeroFrames = 0;
      } else {
        zeroFrames += 1;
      }

      const done =
        zeroFrames >= MAX_ZERO_GROWTH_FRAMES ||
        now - startTs > MAX_SCROLL_DURATION_MS;

      if (done) return;

      rafIdRef.current = requestAnimationFrame(step);
    };

    rafIdRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      // token 무효화 — 이미 예약된 step 콜백이 남아있어도 조기 종료
      scrollTokenRef.current = myToken + 1;
    };
  }, [open]);

  function toggle() {
    setOpen((prev) => !prev);
  }

  return (
    <div className="f-bottom-wrap">
      <div className="f-bottom-row">
        <span className="f-copyright">© 2026 Good Things Roasters</span>
        <span className="f-bottom-sep">·</span>
        <button
          className="f-biz-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="f-biz-detail"
          onClick={toggle}
        >
          사업자 정보{' '}
          <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 300ms ease' }}>▾</span>
        </button>
        <span className="f-bottom-sep">·</span>
        <Link href="/legal/terms" className="f-legal-link">이용약관</Link>
        <span className="f-bottom-sep">·</span>
        <Link href="/legal/privacy" className="f-legal-link">개인정보처리방침</Link>
        <span className="f-bottom-sep">·</span>
        <Link href="/legal/returns" className="f-legal-link">취소·반품·교환</Link>
      </div>

      <div
        ref={bizRef}
        className={`f-biz-inline${open ? ' open' : ''}`}
        id="f-biz-detail"
        aria-hidden={!open}
      >
        <div className="f-biz-inner">
        {BUSINESS_INFO.companyName}<span className="f-biz-sep">·</span>
        대표 {BUSINESS_INFO.ceo}<span className="f-biz-sep">·</span>
        사업자 등록번호 {BUSINESS_INFO.registrationNumber}<span className="f-biz-sep">·</span>
        통신판매업 신고번호 {BUSINESS_INFO.onlineBusinessNumber}{' '}
        <a
          className="f-biz-lookup"
          href={FTC_BIZ_LOOKUP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          [사업자정보 확인]
        </a>
        <span className="f-biz-sep">·</span>
        주소 {BUSINESS_INFO.address}<span className="f-biz-sep">·</span>
        전화번호 {process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '—'}<span className="f-biz-sep">·</span>
        이메일 {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '—'}<span className="f-biz-sep">·</span>
        개인정보관리책임자 {BUSINESS_INFO.privacyOfficer}<span className="f-biz-sep">·</span>
        호스팅 제공자 {BUSINESS_INFO.hostingProvider}
        </div>
      </div>
    </div>
  );
}
