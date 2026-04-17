/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — GET /api/admin/me 단위 테스트 (Session 13, P2-F RBAC)

   커버리지:
   - 401 unauthorized   — claims null
   - 403 forbidden      — 로그인 but isAdmin = false
   - 200 success        — admin 역할
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getClaims: vi.fn(),
  isAdmin: vi.fn(),
}));

import { getClaims, isAdmin } from '@/lib/auth/getClaims';
import { GET } from './route';

const mockGetClaims = vi.mocked(getClaims);
const mockIsAdmin = vi.mocked(isAdmin);

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/me', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetClaims.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('unauthorized');
  });

  it('returns 403 when authenticated but not admin', async () => {
    mockGetClaims.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'user@example.com',
      metadata: {},
    });
    mockIsAdmin.mockResolvedValueOnce(false);

    const res = await GET();
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('forbidden');
  });

  it('returns 200 with role=admin for admin users', async () => {
    mockGetClaims.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'admin@example.com',
      metadata: {},
    });
    mockIsAdmin.mockResolvedValueOnce(true);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { userId: string; email: string; role: string };
    };
    expect(body.data).toEqual({
      userId: USER_ID,
      email: 'admin@example.com',
      role: 'admin',
    });
  });
});
