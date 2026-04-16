/* ══════════════════════════════════════════════════════════════════════════
   utils/maskEmail.ts — 이메일 주소 PII 마스킹 공용 유틸

   2026-04-17 Pass 1 생성 (code-review H-2):
     기존에 `lib/email/sendEmail.ts` 의 maskEmailAddress 와 `lib/payments/mask.ts`
     의 maskEmail 이 서로 다른 규칙으로 분리 구현되어 일관성이 없었다.
     본 파일을 단일 진실의 원천(single source of truth)으로 두고 두 모듈이
     이를 사용하도록 일원화.

   규칙 (로그·DB 저장 공통):
     - local-part 길이 ≤ 1  → `*@domain`
     - local-part 길이 ≥ 2  → `{head}***@domain`  (head = 첫 1자)
     - `@` 없는 문자열      → `***`  (확실한 차단)

   설계 근거:
     - tail 자리 노출은 일부 PII 식별성을 남기므로 저장·로그 모두 보수적으로 제거.
     - 길이 정보는 공격자가 재식별할 수 있는 보조 신호이므로 `***` 고정 폭 사용.
     - null/undefined 는 상위에서 각자 처리 (본 유틸은 문자열만 받음).

   로그 인젝션 방어 (security-review M-1):
     - 반환 전 CR/LF 및 기타 제어문자 스트립. 호출 측이 템플릿 리터럴에
       임베드해도 로그 라인이 깨지지 않는다.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * 로그·DB 저장용 이메일 주소 마스킹.
 * - `johndoe@example.com` → `j***@example.com`
 * - `a@example.com`       → `*@example.com`
 * - `notanemail`          → `***`
 */
export function maskEmailAddress(email: string): string {
  const sanitized = stripControl(email);
  const atIdx = sanitized.indexOf('@');
  if (atIdx <= 0) return '***';
  const local = sanitized.slice(0, atIdx);
  const domain = sanitized.slice(atIdx);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}***${domain}`;
}

/**
 * 단일 또는 배열 수신자를 마스킹. 배열은 콤마로 조인.
 */
export function maskRecipients(to: string | string[]): string {
  if (Array.isArray(to)) {
    return to.map(maskEmailAddress).join(',');
  }
  return maskEmailAddress(to);
}

/** 로그 인젝션 방지 — CR/LF 및 제어문자 제거. */
function stripControl(v: string): string {
  return v.replace(/[\u0000-\u001F\u007F]/g, '');
}
