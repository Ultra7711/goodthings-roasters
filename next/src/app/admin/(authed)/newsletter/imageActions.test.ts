/* ══════════════════════════════════════════
   imageActions.test.ts — uploadNewsletterImageAction 가드 (S250-2 Phase 2)
   - unauthorized: getAdminClaims null
   - validation_failed: file 누락
   (ok 경로는 sharp/plaiceholder/Storage 의존 → products 와 동일하게 미테스트)
   ══════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminClaims: vi.fn(),
}));

import { uploadNewsletterImageAction } from './imageActions';
import { getAdminClaims } from '@/lib/auth/getClaims';

const adminClaimsMock = vi.mocked(getAdminClaims);

const CLAIMS = {
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
  adminClaimsMock.mockResolvedValue(CLAIMS);
});

describe('uploadNewsletterImageAction', () => {
  it('unauthorized — getAdminClaims null', async () => {
    adminClaimsMock.mockResolvedValueOnce(null);
    const res = await uploadNewsletterImageAction(new FormData());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — file 누락', async () => {
    const res = await uploadNewsletterImageAction(new FormData());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('validation_failed');
      expect(res.detail).toBe('file_missing');
    }
  });
});
