/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — POST /api/account/delete 단위 테스트 (Session 8-E)

   커버리지:
   - 401 unauthorized          — claims 없음
   - 400 validation_failed     — confirm 문자열 불일치
   - 409 conflict              — RPC 'subscription_active'
   - 500 server_error          — auth.admin.deleteUser 실패 (orphan 경로)
   - 200 success               — RPC + deleteUser + signOut 정상

   Mock 전략:
   - vi.mock 으로 csrf / ratelimit / getClaims / supabaseAdmin / supabaseServer 를
     차단. enforceSameOrigin·checkRateLimit 은 null (통과) 반환하도록 기본값 지정.
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Module mocks (import 전에 선언) ─────────────────────────────────── */

vi.mock('@/lib/api/csrf', () => ({
  enforceSameOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));

vi.mock('@/lib/auth/getClaims', () => ({
  getClaims: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(async () => ({
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  })),
}));

vi.mock('@/lib/auth/logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/logger')>(
    '@/lib/auth/logger',
  );
  return {
    ...actual,
    logAuthEvent: vi.fn(),
  };
});

/* ── SUT + mocked module imports ─────────────────────────────────────── */

import { POST } from './route';
import { getClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const getClaimsMock = vi.mocked(getClaims);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

/* ── Helpers ─────────────────────────────────────────────────────────── */

function makeRequest(body: unknown): Request {
  return new Request('https://goodthings-roasters.com/api/account/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://goodthings-roasters.com',
    },
    body: JSON.stringify(body),
  });
}

type AdminStubOptions = {
  rpcError?: { message: string; code?: string } | null;
  rpcData?: unknown;
  deleteUserError?: { message: string; status?: number } | null;
};

function makeAdminStub(opts: AdminStubOptions = {}) {
  const rpc = vi.fn(async () => ({
    data: opts.rpcData ?? { orders_anonymized: 2, subscriptions_deleted: 1 },
    error: opts.rpcError ?? null,
  }));
  const deleteUser = vi.fn(async () => ({
    data: null,
    error: opts.deleteUserError ?? null,
  }));
  return {
    rpc,
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

/* ── Tests ───────────────────────────────────────────────────────────── */

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaimsMock.mockResolvedValue({
      userId: 'user-uuid-123',
      email: 'alice@example.com',
    } as Awaited<ReturnType<typeof getClaims>>);
  });

  it('401 — 비로그인 요청은 unauthorized', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ confirm: '탈퇴' }));
    expect(res.status).toBe(401);
  });

  it('400 — confirm 문자열 불일치 시 validation_failed', async () => {
    const res = await POST(makeRequest({ confirm: '취소' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('validation_failed');
    expect(body.detail).toBe('confirm_phrase_mismatch');
  });

  it('409 — 활성 구독 존재 시 subscription_active conflict', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        rpcError: { message: 'subscription_active', code: 'P0001' },
      }),
    );
    const res = await POST(makeRequest({ confirm: '탈퇴' }));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.error).toBe('conflict');
    expect(body.detail).toBe('subscription_active');
  });

  it('500 — auth.admin.deleteUser 실패 시 orphan 경로 server_error', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        deleteUserError: { message: 'boom', status: 500 },
      }),
    );
    const res = await POST(makeRequest({ confirm: '탈퇴' }));
    expect(res.status).toBe(500);
  });

  it('200 — 정상 탈퇴 시 ordersAnonymized / subscriptionsDeleted 반환', async () => {
    const admin = makeAdminStub({
      rpcData: { orders_anonymized: 3, subscriptions_deleted: 2 },
    });
    getSupabaseAdminMock.mockReturnValue(admin);
    const res = await POST(makeRequest({ confirm: '탈퇴' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { deleted: boolean; ordersAnonymized: number; subscriptionsDeleted: number };
    };
    expect(body.data.deleted).toBe(true);
    expect(body.data.ordersAnonymized).toBe(3);
    expect(body.data.subscriptionsDeleted).toBe(2);

    /* RPC 가 올바른 p_user_id 로 호출됐는지 */
    const rpcMock = (admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpcMock).toHaveBeenCalledWith('delete_account', {
      p_user_id: 'user-uuid-123',
    });
  });

  it('400 — invalid_json body 는 validation_failed', async () => {
    const req = new Request('https://goodthings-roasters.com/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://goodthings-roasters.com',
      },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('invalid_json');
  });
});
