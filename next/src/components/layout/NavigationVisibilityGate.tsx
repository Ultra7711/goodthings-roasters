/* ══════════════════════════════════════════
   NavigationVisibilityGate
   BUG-007 / H8 — prev-page 2-frame 잔상 차단 prototype A (S71)

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

   비교 후보 (회귀 발견 시 단계 업그레이드):
         접근 B = visibility + .root background route-aware (다크 진입 case
         정밀 보정)

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

export default function NavigationVisibilityGate() {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  /* capture-phase click → destination Link 감지 → main hide */
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
    if (prevPathRef.current !== pathname) {
      window.dispatchEvent(
        new CustomEvent<string>('gtr:route-change', { detail: pathname }),
      );
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}
