/* ══════════════════════════════════════════════════════════════════════════
   getClaims.test.ts — isAdmin / getAdminClaims 단위 테스트 (Session 13)

   커버리지:
   - isAdmin: rpc true/false/error
   - getAdminClaims: unauthenticated / non-admin / admin
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(async () => ({
    rpc: mockRpc,
    auth: { getUser: vi.fn() },
  })),
}));

import { isAdmin, getAdminClaims, getClaims } from './getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockReset();
});

describe('isAdmin', () => {
  it('returns true when rpc returns true', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    const result = await isAdmin(USER_ID);
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('is_admin', { uid: USER_ID });
  });

  it('returns false when rpc returns false', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await isAdmin(USER_ID)).toBe(false);
  });

  it('returns false when rpc returns null (defensive)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await isAdmin(USER_ID)).toBe(false);
  });

  it('returns false and logs error on rpc error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc boom' },
    });
    expect(await isAdmin(USER_ID)).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('getAdminClaims', () => {
  it('returns null when unauthenticated', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValueOnce({
      rpc: mockRpc,
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);

    const result = await getAdminClaims();
    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns null when authenticated but non-admin', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValue({
      rpc: mockRpc,
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: USER_ID, email: 'u@example.com', user_metadata: {} },
          },
          error: null,
        })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const result = await getAdminClaims();
    expect(result).toBeNull();
  });

  it('returns AdminClaims for admin users', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValue({
      rpc: mockRpc,
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: USER_ID,
              email: 'admin@example.com',
              user_metadata: { full_name: 'Admin' },
            },
          },
          error: null,
        })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await getAdminClaims();
    expect(result).toEqual({
      userId: USER_ID,
      email: 'admin@example.com',
      metadata: { full_name: 'Admin' },
      role: 'admin',
    });
  });
});

describe('getClaims sanity (shared mock)', () => {
  it('returns null when no user', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValueOnce({
      rpc: mockRpc,
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    expect(await getClaims()).toBeNull();
  });
});
