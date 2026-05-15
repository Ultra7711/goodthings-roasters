/* ══════════════════════════════════════════════════════════════════════════
   actions.test.ts — /admin/users Server Action 단위 테스트 (S169 PR-3 Group C-3)

   커버리지:
   - unauthorized — getAdminClaims null
   - validation_failed — invalid uuid / reason length
   - self_action — actor === target (UI 단 차단 · RPC 호출 안됨)
   - self_action — RPC self-(grant|revoke) exception 매핑
   - unauthorized — RPC insufficient_privilege (non-admin actor) 매핑
   - server_error — 그 외 RPC 에러
   - ok — 정상 흐름 (revalidatePath 호출 검증)
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminClaims: vi.fn(),
  getAdminOwnerClaims: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { grantAdminAction, revokeAdminAction } from './actions';
import { getAdminOwnerClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

const getAdminOwnerClaimsMock = vi.mocked(getAdminOwnerClaims);
const createClientMock = vi.mocked(createRouteHandlerClient);
const revalidatePathMock = vi.mocked(revalidatePath);

const ACTOR_ID = '11111111-1111-1111-1111-111111111111';
const TARGET_ID = '22222222-2222-2222-2222-222222222222';

const ADMIN_CLAIMS = {
  userId: ACTOR_ID,
  email: 'admin@example.com',
  metadata: {},
  role: 'admin' as const,
  adminLevel: 'owner' as const,
  displayName: null,
  title: null,
};

type RpcError = { code: string; message: string } | null;

function makeSupabaseStub(rpcError: RpcError) {
  const rpc = vi.fn(async () => ({ data: null, error: rpcError }));
  return { rpc } as unknown as Awaited<ReturnType<typeof createRouteHandlerClient>>;
}

describe('grantAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminOwnerClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  afterAll(() => vi.resetAllMocks());

  it('unauthorized — getAdminOwnerClaims null (staff 또는 비admin)', async () => {
    getAdminOwnerClaimsMock.mockResolvedValueOnce(null);
    const result = await grantAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('validation_failed — invalid uuid', async () => {
    const result = await grantAdminAction({ targetId: 'not-a-uuid' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
      expect(result.detail).toContain('targetId');
    }
  });

  it('validation_failed — reason 빈 문자열 (trim 후 min(1) 위반)', async () => {
    const result = await grantAdminAction({ targetId: TARGET_ID, reason: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
      expect(result.detail).toContain('reason');
    }
  });

  it('validation_failed — reason 500자 초과', async () => {
    const result = await grantAdminAction({
      targetId: TARGET_ID,
      reason: 'a'.repeat(501),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('validation_failed');
  });

  it('self_action — UI 단 차단 (actor === target, RPC 호출 안됨)', async () => {
    const result = await grantAdminAction({ targetId: ACTOR_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('self_action');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('self_action — RPC self-grant exception 매핑', async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseStub({ code: '42501', message: 'cannot self-grant admin' }),
    );
    const result = await grantAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('self_action');
  });

  it('unauthorized — RPC insufficient_privilege (non-admin actor) 매핑', async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseStub({ code: '42501', message: 'admin role required' }),
    );
    const result = await grantAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('server_error — 그 외 RPC 에러', async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseStub({ code: 'XX000', message: 'pg internal' }),
    );
    const result = await grantAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('server_error');
  });

  it('ok — 정상 흐름 + revalidatePath 호출', async () => {
    createClientMock.mockResolvedValue(makeSupabaseStub(null));
    const result = await grantAdminAction({ targetId: TARGET_ID, reason: '신규 운영자' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.targetId).toBe(TARGET_ID);
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/users');
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/users/${TARGET_ID}`);
  });
});

describe('revokeAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminOwnerClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  it('self_action — UI 단 차단', async () => {
    const result = await revokeAdminAction({ targetId: ACTOR_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('self_action');
  });

  it('self_action — RPC self-revoke exception 매핑', async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseStub({ code: '42501', message: 'cannot self-revoke admin' }),
    );
    const result = await revokeAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('self_action');
  });

  it('ok — 정상 흐름', async () => {
    createClientMock.mockResolvedValue(makeSupabaseStub(null));
    const result = await revokeAdminAction({ targetId: TARGET_ID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.targetId).toBe(TARGET_ID);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/users/${TARGET_ID}`);
  });
});
