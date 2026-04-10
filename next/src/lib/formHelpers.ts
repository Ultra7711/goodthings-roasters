/* ══════════════════════════════════════════
   formHelpers
   폼 입력 필드용 공용 유틸.
   프로토타입의 "Enter 키로 다음 필드 이동" UX를 Next.js 폼에 통일 적용.
   ══════════════════════════════════════════ */

import type { KeyboardEvent, RefObject } from 'react';

/**
 * Enter 키 입력 시 다음 입력 필드로 포커스를 이동한다.
 *
 * 규칙:
 * - Enter 가 아니면 no-op.
 * - IME(한국어 등) 조합 중이면 no-op — 조합 확정용 Enter 가 필드 이동으로 오인되지 않도록.
 * - nextRef.current 가 없거나 disabled 면 preventDefault 하지 않고 return →
 *   브라우저 기본 form submit 으로 흐른다(마지막 필드 또는 비활성 필드 케이스).
 * - 그 외에는 preventDefault 후 nextRef.current.focus() 호출.
 *
 * 사용 예:
 * ```tsx
 * const passwordRef = useRef<HTMLInputElement>(null);
 * <Input
 *   onKeyDown={(e) => focusNextOnEnter(e, passwordRef)}
 * />
 * <Input ref={passwordRef} />
 * ```
 */
export function focusNextOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  nextRef: RefObject<HTMLInputElement | null>,
): void {
  if (event.key !== 'Enter') return;

  /* IME 조합 중 — React SyntheticEvent 래핑을 뚫어 nativeEvent.isComposing 확인 */
  if (event.nativeEvent.isComposing) return;
  /* 구형 브라우저 호환: 조합 중 keyCode === 229 */
  if (event.keyCode === 229) return;

  const next = nextRef.current;

  /* 다음 필드가 없거나 비활성 — 기본 submit 흐름 유지 */
  if (!next || next.disabled) return;

  event.preventDefault();
  next.focus();
}
