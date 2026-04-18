/* ══════════════════════════════════════════════════════════════════════════
   email/templates/utils.ts — 이메일 템플릿 공용 유틸

   esc(): HTML 컨텍스트에 삽입되는 동적 값의 HTML 인젝션 방어.
   stripNewlines(): subject 등 헤더 필드의 CRLF 인젝션 방어.
   ════════════════════════════════════════════════════════════════════════ */

/**
 * HTML 인젝션 방어 이스케이퍼. 이메일 템플릿의 모든 동적 값에 적용한다.
 * DB 데이터, OAuth 사용자 입력, 외부 API 응답 모두 포함.
 */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * 이메일 subject·header 필드에서 CRLF 인젝션 방어.
 * Resend SDK가 내부적으로 처리할 수 있으나 코드 레벨 방어를 추가한다.
 */
export function stripNewlines(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
