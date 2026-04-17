/* ══════════════════════════════════════════
   useIsMounted
   비동기 콜백이 언마운트 이후 setState 를 호출하는 회귀를 차단.

   사용:
     const isMounted = useIsMounted();
     ...
     const data = await fetch(...);
     if (isMounted.current) setState(data);

   주의:
   - `isMounted.current` 는 ref 이므로 effect 의존성 배열에 넣지 않아도 됨.
   - StrictMode 개발 모드 이중 마운트 하에서도 cleanup → remount 순서로
     `true → false → true` 로 복원됨 (useEffect cleanup + mount 재실행).

   도입 배경 (M-11):
   - CheckoutPage 에서 submit 쪽에 동일 패턴 중복 → 공용 훅 추출.
   ══════════════════════════════════════════ */

import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * 컴포넌트의 마운트 상태를 추적하는 ref 를 반환.
 *
 * @returns `{ current: boolean }` — 마운트 후 true, 언마운트 후 false.
 */
export function useIsMounted(): MutableRefObject<boolean> {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
