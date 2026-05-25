/* ══════════════════════════════════════════════════════════════════════════
   getClaims.test.ts — isAdmin / getAdminClaims 단위 테스트 (Session 13)

   커버리지:
   - isAdmin: rpc true/false/error
   - getAdminClaims: unauthenticated / non-admin / admin
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();

/* getAdminClaims 가 사용하는 .from('profiles').select(...).eq(...).maybeSingle() 체인 mock.
   maybeSingle 만 vi.fn 으로 두고 나머지는 fluent return. */
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: { getUser: vi.fn() },
  })),
}));

import { isAdmin, getAdminClaims, getClaims } from './getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockReset();
  mockMaybeSingle.mockReset();
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
      from: mockFrom,
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: USER_ID, email: 'u@example.com', user_metadata: {} },
          },
          error: null,
        })),
        /* S282-P3: getAdminClaims 가 JWT app_metadata 직독을 시도 — session null → DB fallback. */
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    /* profile maybeSingle 은 admin 검증 실패 시 결과가 무시되지만 mock 은 호출됨 (Promise.all). */
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getAdminClaims();
    expect(result).toBeNull();
  });

  it('returns AdminClaims with displayName + title for admin users', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
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
        /* S282-P3: JWT 직독 시도 — session null → DB fallback (profiles.admin_level). */
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockMaybeSingle.mockResolvedValueOnce({
      data: { display_name: '정현우', title: '대표 · Owner', admin_level: 'owner' },
      error: null,
    });

    const result = await getAdminClaims();
    expect(result).toEqual({
      userId: USER_ID,
      email: 'admin@example.com',
      metadata: { full_name: 'Admin' },
      role: 'admin',
      adminLevel: 'owner',
      displayName: '정현우',
      title: '대표 · Owner',
    });
  });

  it('returns AdminClaims with null fields when profile row missing', async () => {
    const clientMock = vi.mocked(createRouteHandlerClient);
    clientMock.mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: USER_ID,
              email: 'admin@example.com',
              user_metadata: {},
            },
          },
          error: null,
        })),
        /* S282-P3: JWT 직독 시도 — session null → DB fallback (admin_level='staff'). */
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      },
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    } as any);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getAdminClaims();
    expect(result).toEqual({
      userId: USER_ID,
      email: 'admin@example.com',
      metadata: {},
      role: 'admin',
      adminLevel: 'staff',  /* profile row missing → 보수적 fallback */
      displayName: null,
      title: null,
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
