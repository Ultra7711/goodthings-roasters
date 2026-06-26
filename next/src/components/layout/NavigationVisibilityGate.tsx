/* ══════════════════════════════════════════
   NavigationVisibilityGate
   BUG-007 / H8 — prev-page 2-frame 잔상 차단 prototype A (S71)
   BUG-178 접근 B — .root background route-aware (다크 진입 보정, S94)
   BUG-130 접근 C — 헤더 테마 클래스 DOM 직접 선제 토글 (S96)

   문제: Next.js 16 + React 19 의 startTransition 기반 navigation 에서
         click → React new tree build → commit 사이 ~34.7ms 동안 prev DOM
         가 viewport 에 그대로 잔존 (M-003). 다크→라이트 전환 case 에서
         사용자 체감 가장 큼.

   §11-8 (S71) 측정 단서:
         <main> 핑크 보임 + .page-bg 핑크 안 보임 → main 영역 가시성 제어가
         가장 직접적 접근. .root warm-white 가 그 위 stack 차지.

   해결 (접근 A · 단순):
         capture-phase click 으로 destination Link 감지 → <main> 에
         data-transitioning="true" 부여 → CSS visibility:hidden 으로
         prev DOM 즉시 비가시 → useLayoutEffect (new pathname commit) 에서
         속성 제거 → paint 전 새 DOM 가시.

   접근 B (다크 진입 보정):
         destination 이 DARK_ROUTES (/ · /story) 이면 .root 에
         data-dest-dark="true" 추가 → CSS background 즉시 다크 전환 →
         #main-content visibility:hidden 중 흰색 배경 노출 차단.
         useLayoutEffect 에서 pathname 변경 시 속성 제거.

   접근 C (헤더 테마 선제 토글, S96):
         React useHeaderTheme 은 route-change event → effectivePath state →
         re-render 경로를 거쳐 2 render cycle 지연이 발생.
         click handler 에서 #site-hdr-wrap 헤더 클래스를 DOM 직접 조작하여
         배경과 동일 tick 에 전환. hdr-instant 로 transition 억제 후
         useLayoutEffect 에서 제거 (새 pathname commit 시점 = 첫 paint 전).
         React 의 className reconciliation 이 덮어쓸 수 있지만
         실제로는 startTransition 완료 전까지 헤더 re-render 가 없어 안전.

   SR / IO 영향: visibility 는 IntersectionObserver 와 무관 (IO 는 viewport
   intersection 기반) → SR reveal 정상 fire. 안전.

   금지 패턴 회피 (failure_catalog X1~X10):
         - X1 (html bg toggle) ❌ 미사용
         - X8 (.root transparent) ❌ 미사용 — .root 그대로 유지
         - X3 (critical CSS inline) ❌ 미사용
         - X5 (인라인 script) ❌ 미사용
         - 새 overlay 추가 없음 — 기존 <main> 의 visibility 만 토글
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { HeaderTheme } from '@/types/navigation';

const DARK_ROUTES = new Set(['/', '/story']);
const SECONDARY_ROUTES = new Set(['/shop']);

/* hash anchor 도착 섹션의 헤더 테마 정적 매핑 (S103).
   페이지 top 기준 initialTheme(headerThemeConfig) 와 hash 도착지가 다른 섹션이면
   첫 paint 에 잘못된 테마 적용 → 다크 프레임 깜빡임. 클릭 시점에 destination
   섹션의 테마를 #site-hdr-wrap[data-pending-section-theme] 로 인계하여
   useHeaderTheme.useLayoutEffect 가 initialTheme 대신 사용한다. */
const HASH_SECTION_THEMES: Record<string, HeaderTheme> = {
  '/story#location': 'light',
};

const HDR_DARK = 'hdr-dark';
const HDR_INSTANT = 'hdr-instant';
const HDR_ON_SECONDARY = 'hdr-on-secondary';
const PENDING_SECTION_THEME_ATTR = 'data-pending-section-theme';

/* S334: 홈(/) 전환 커버 — #main-content visibility:hidden 동안 보이는 .root 배경을
   히어로 진입 레이어(.hero-bg-poster)와 일치시켜 "전환 정적 poster → 진입 캡처 frameX" 점프를 제거.
   - 가까운 재진입(Activity 유지): .hero-bg-poster DOM 생존 + cleanup 이 박은 inline 캡처 frameX 존재
     → .root 에 미러 → 전환~진입 모두 동일 frameX.
   - unmount 재방문/cold: .hero-bg-poster DOM 없음 또는 inline 빈값 → .root 정리 →
     CSS .root[data-dest-home] poster.webp 폴백(영상도 frame0 → 일치).
   style.backgroundImage 는 inline 값만 반환 → fresh mount("")와 재진입("url(...)")이 구분됨(전역 stale 불가). */
function syncRootHeroCover(root: HTMLElement | null, isHome: boolean) {
  if (!root) return;
  if (!isHome) {
    root.style.backgroundImage = '';
    return;
  }
  const poster = document.querySelector<HTMLElement>('.hero-bg-poster');
  const inlineBg = poster?.style.backgroundImage;
  root.style.backgroundImage = inlineBg && inlineBg !== 'none' ? inlineBg : '';
}

export default function NavigationVisibilityGate() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  /* capture-phase click → destination Link 감지 → main hide + dark-route 보정 */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // 좌클릭만 + 수정자 키 없음 (ctrl/cmd 클릭 새 탭 case 제외)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      // 외부·해시·메일·전화·다운로드 skip
      if (
        href.startsWith('#') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      )
        return;
      if (link.hasAttribute('download')) return;
      const target = link.getAttribute('target');
      if (target && target !== '_self') return;
      // same path skip (search/hash 변경만)
      if (
        href === pathname ||
        href.startsWith(`${pathname}?`) ||
        href.startsWith(`${pathname}#`)
      )
        return;
      const main = document.getElementById('main-content');
      if (main) main.setAttribute('data-transitioning', 'true');
      // 접근 B: 다크 라우트 진입 시 .root 배경 즉시 다크 전환 (BUG-178)
      // S283-B: html.dest-dark class 도 동기 (라이트 라우트 이동 시 stale 차단).
      const root = document.querySelector<HTMLElement>('.root');
      const html = document.documentElement;
      if (DARK_ROUTES.has(href)) {
        root?.setAttribute('data-dest-dark', 'true');
        html.classList.add('dest-dark');
      } else {
        root?.removeAttribute('data-dest-dark');
        html.classList.remove('dest-dark');
      }
      // S333: 홈(/) 진입 전환 동안 .root 가 다크 대신 hero webp 를 보이게 → 재진입 "다크 먼저" 제거.
      if (href === '/') root?.setAttribute('data-dest-home', 'true');
      else root?.removeAttribute('data-dest-home');
      // S334: .root 전환 커버를 히어로 진입 레이어(.hero-bg-poster inline)와 동기 (점프 제거).
      syncRootHeroCover(root, href === '/');
      // 접근 C: 헤더 테마 클래스 선제 토글 (BUG-130, S96)
      // React state 경로(2 render cycle 지연) 없이 배경과 동일 tick에 전환.
      // hdr-instant로 transition 억제 → useLayoutEffect에서 제거.
      const header = document.getElementById('site-hdr-wrap');
      if (header) {
        header.classList.add(HDR_INSTANT);
        if (DARK_ROUTES.has(href)) {
          header.classList.add(HDR_DARK);
          header.classList.remove(HDR_ON_SECONDARY);
        } else if (SECONDARY_ROUTES.has(href)) {
          header.classList.remove(HDR_DARK);
          header.classList.add(HDR_ON_SECONDARY);
        } else {
          header.classList.remove(HDR_DARK, HDR_ON_SECONDARY);
        }
        /* hash anchor 도착 섹션 테마 인계 (S103).
           useHeaderTheme.useLayoutEffect 가 이 속성을 읽고 initialTheme override.
           DOM setAttribute 는 동기 → React commit 전에 set 보장. */
        const pendingTheme = HASH_SECTION_THEMES[href];
        if (pendingTheme) {
          header.setAttribute(PENDING_SECTION_THEME_ATTR, pendingTheme);
        } else {
          header.removeAttribute(PENDING_SECTION_THEME_ATTR);
        }
      }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () =>
      document.removeEventListener('click', onClick, { capture: true });
  }, [pathname]);

  /* pathname 변화 또는 mount 시 → useLayoutEffect (paint 전) → 속성 제거.
     안전망 강화: prevPathRef === null (mount 첫 실행) 케이스도 attribute
     제거. (main) ↔ /login 처럼 route group 경계 넘는 navigation 으로
     (main) layout 이 unmount 후 re-mount 되는 시점에 visibility hidden 이
     stuck 되는 것 방지.

     추가 책임 (DB-06/10/11 S72): 페이지 컴포넌트는 Next.js 16 + React 19
     Activity 하에서 `display:none` 으로 hidden 될 때 effect 가 defer 됨
     (`useEffect` deps 에 pathname 을 추가해도 재진입 시 fire 되지 않음).
     Layout 은 Activity 밖이므로 여기서 route change custom event 를 발송 →
     각 페이지가 window listener 로 수신하여 entry animation 재생. */
  useLayoutEffect(() => {
    const main = document.getElementById('main-content');
    if (main) main.removeAttribute('data-transitioning');
    /* S283 fix: 초기 진입 (URL 직접 / 새로고침 / dev hard reload) = click event 발화 X →
       data-dest-dark 박힘 안 됨 → .root default light bg 비춰 보임 → #home-body stFadeIn
       opacity 0~1 동안 흰 플래시. mount 시점에도 DARK_ROUTES 면 강제 set.
       S283-B: html.dest-dark class 도 동기 (<head> inline script 가 첫 mount 만 박음 →
       SPA navigation 시 stale → 라이트 라우트도 다크 비춰 보임). */
    const root = document.querySelector<HTMLElement>('.root');
    const html = document.documentElement;
    if (DARK_ROUTES.has(pathname)) {
      root?.setAttribute('data-dest-dark', 'true');
      html.classList.add('dest-dark');
    } else {
      root?.removeAttribute('data-dest-dark');
      html.classList.remove('dest-dark');
    }
    // S333: 홈 머무는 동안 data-dest-home 유지(전환 시 webp 노출) · 이탈 시 제거.
    if (pathname === '/') root?.setAttribute('data-dest-home', 'true');
    else root?.removeAttribute('data-dest-home');
    // S334: .root 전환 커버 보정 (click 미발화 케이스: 직접 진입/새로고침/route group 경계).
    syncRootHeroCover(root, pathname === '/');
    // 접근 C: hdr-instant 제거 → 이후 React re-render부터 transition 복원
    const header = document.getElementById('site-hdr-wrap');
    if (header) header.classList.remove(HDR_INSTANT);
    if (prevPathRef.current !== pathname) {
      window.dispatchEvent(
        new CustomEvent<string>('gtr:route-change', { detail: pathname }),
      );
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  /* S203 — setTimeout 폐기. console log 가 명확히 입증:
     [101158ms] data-dest-dark = true (capture-phase set)
     [101572ms] home-body fade animation start (opacity 0)
     [101665ms] data-dest-dark = REMOVED  ← setTimeout 400ms 발화 시점
                opacity = 0.835 (1 도달 못 함, 17% 부족 cover)
                .root bg = light → main 영역 부분 light 노출 = 흰 plash
     [101921ms] opacity = 1 (fade 완료, 256ms 더 걸림)

     setTimeout race 자체 폐기. 다크 라우트 동안 attribute 영구 유지.
     다음 비다크 라우트 이동 시 capture-phase 또는 useLayoutEffect 가 제거. */

  return null;
}
