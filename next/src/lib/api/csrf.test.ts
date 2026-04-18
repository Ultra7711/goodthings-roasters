/* ══════════════════════════════════════════════════════════════════════════
   csrf.test.ts — Origin 기반 CSRF 가드 테스트 (P2-A Pass 1 H-2)

   대상: isOriginAllowed (순수) — enforceSameOrigin 은 env 의존 통합 범위
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { isOriginAllowed } from './csrf';

const ALLOWED = new Set<string>([
  'https://goodthings-roasters.com',
  'http://localhost:3000',
]);

function makeReq(
  url: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers });
}

describe('isOriginAllowed', () => {
  it('Origin 이 허용 목록에 있으면 통과', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders', {
      origin: 'https://goodthings-roasters.com',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(true);
  });

  it('Origin 이 허용 목록에 없으면 차단', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders', {
      origin: 'https://evil.example.com',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(false);
  });

  it('Origin 없고 Referer 로 fallback 가능', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders', {
      referer: 'https://goodthings-roasters.com/checkout',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(true);
  });

  it('Origin·Referer 모두 없으면 차단 (비브라우저 호출 방어)', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders');
    expect(isOriginAllowed(req, ALLOWED)).toBe(false);
  });

  it('Origin 이 요청 URL 의 self origin 과 동일하면 통과 (allowed 에 없어도)', () => {
    /* 배포 URL 이 NEXT_PUBLIC_SITE_URL 과 다른 preview 도메인인 케이스를 시뮬레이션 */
    const req = makeReq('https://preview-abc.vercel.app/api/orders', {
      origin: 'https://preview-abc.vercel.app',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(true);
  });

  it('Origin 의 프로토콜/호스트가 같아야 함 (http vs https 구분)', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders', {
      origin: 'http://goodthings-roasters.com',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(false);
  });

  it('Referer 가 부서진 URL 이면 차단', () => {
    const req = makeReq('https://goodthings-roasters.com/api/orders', {
      referer: 'not-a-url',
    });
    expect(isOriginAllowed(req, ALLOWED)).toBe(false);
  });
});
