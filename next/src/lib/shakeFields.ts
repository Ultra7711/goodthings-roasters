/* ══════════════════════════════════════════
   shakeFields — 검증 실패 필드에 shake 애니메이션 트리거
   .input-warn 클래스가 붙은 .chp-field 또는 .bi-field 에
   .input-shake 를 추가하고 애니메이션 종료 후 자동 제거.
   ══════════════════════════════════════════ */

export function shakeFields(container?: HTMLElement | null) {
  const root = container || document;
  const fields = root.querySelectorAll<HTMLElement>(
    '.chp-field.input-warn, .bi-field.bi-input-warn',
  );
  fields.forEach((el) => {
    el.classList.remove('input-shake');
    // force reflow to re-trigger animation
    void el.offsetWidth;
    el.classList.add('input-shake');
    el.addEventListener('animationend', () => el.classList.remove('input-shake'), { once: true });
  });
}
