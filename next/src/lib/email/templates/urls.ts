/* ══════════════════════════════════════════════════════════════════════════
   email/templates/urls.ts — 이메일 CTA 링크 빌더

   Session 11 보안 #3-4a:
   - 고객 대면 주문 조회 URL 에서 `order_number` 제거, `public_token` (UUID v4) 사용.
   - order_number enumeration / competitive intelligence 표면 차단.
   - 업계 표준 (Stripe `pi_xxx` / Toss `tviva_xxx`).
   ════════════════════════════════════════════════════════════════════════ */

const APP_URL_DEFAULT = 'https://goodthingsroasters.com';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `NEXT_PUBLIC_APP_URL` 환경변수 → 후행 슬래시 제거.
 * 누락 시 goodthingsroasters.com 으로 폴백.
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || APP_URL_DEFAULT;
  return raw.replace(/\/+$/, '');
}

/**
 * `/order-complete?token={publicToken}` 절대 URL 빌더.
 * UUID v4 형식이 아니면 null (CTA 블록을 렌더링하지 않음).
 */
export function buildOrderCompleteUrl(publicToken: string | undefined): string | null {
  if (!publicToken || !UUID_V4_PATTERN.test(publicToken)) return null;
  return `${getAppUrl()}/order-complete?token=${publicToken}`;
}
