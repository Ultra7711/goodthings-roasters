/* ══════════════════════════════════════════
   actions.test.ts — exportNewsletterSubscribersXlsxAction 가드 (S250-2)
   - unauthorized: getAdminOwnerClaims null (staff/비admin)
   - validation_failed: invalid status
   (ok 경로는 xlsx/fetch 다수 의존 → users export 와 동일하게 미테스트)
   ══════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminOwnerClaims: vi.fn(),
}));

import { exportNewsletterSubscribersXlsxAction } from './actions';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';

const ownerClaimsMock = vi.mocked(getAdminOwnerClaims);

const OWNER_CLAIMS = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'owner@example.com',
  metadata: {},
  role: 'admin' as const,
  adminLevel: 'owner' as const,
  displayName: null,
  title: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  ownerClaimsMock.mockResolvedValue(OWNER_CLAIMS);
});

describe('exportNewsletterSubscribersXlsxAction', () => {
  it('unauthorized — getAdminOwnerClaims null', async () => {
    ownerClaimsMock.mockResolvedValueOnce(null);
    const res = await exportNewsletterSubscribersXlsxAction({ status: 'all', q: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — invalid status', async () => {
    const res = await exportNewsletterSubscribersXlsxAction({
      status: 'bogus' as unknown as 'all',
      q: '',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });
});
