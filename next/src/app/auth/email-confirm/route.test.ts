/* ══════════════════════════════════════════
   route.test.ts — GET /auth/email-confirm (S302)

   커버리지:
   - token_hash 누락 → /mypage?error=email_confirm_failed
   - type != email_change → error 리다이렉트
   - verifyOtp 에러 → error 리다이렉트
   - verifyOtp 성공 → /mypage?emailRegistered=1
   ══════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(async () => ({
    auth: { verifyOtp },
  })),
}));

import { GET } from './route';

const ORIGIN = 'https://goodthings-roasters.com';

function makeRequest(query: string): Request {
  return new Request(`${ORIGIN}/auth/email-confirm${query}`, { method: 'GET' });
}

function locationOf(res: Response): string {
  return res.headers.get('location') ?? '';
}

beforeEach(() => {
  verifyOtp.mockReset();
});

describe('GET /auth/email-confirm', () => {
  it('token_hash 누락 시 error 리다이렉트', async () => {
    const res = await GET(makeRequest('?type=email_change'));
    expect(locationOf(res)).toBe(`${ORIGIN}/mypage?error=email_confirm_failed`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('type 이 email_change 아니면 error 리다이렉트', async () => {
    const res = await GET(makeRequest('?token_hash=abc&type=signup'));
    expect(locationOf(res)).toBe(`${ORIGIN}/mypage?error=email_confirm_failed`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('verifyOtp 에러 시 error 리다이렉트', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { code: 'otp_expired' } });
    const res = await GET(makeRequest('?token_hash=abc&type=email_change'));
    expect(locationOf(res)).toBe(`${ORIGIN}/mypage?error=email_confirm_failed`);
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email_change', token_hash: 'abc' });
  });

  it('verifyOtp 성공 시 emailRegistered 리다이렉트', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null });
    const res = await GET(makeRequest('?token_hash=abc&type=email_change'));
    expect(locationOf(res)).toBe(`${ORIGIN}/mypage?emailRegistered=1`);
  });
});
