/* ══════════════════════════════════════════════════════════════════════════
   actions.test.ts — /admin/biz-inquiries updateBizInquiryStatus (S250-3)

   커버리지:
   - unauthorized — getAdminClaims null
   - validation_failed — invalid uuid / invalid status
   - server_error — UPDATE 에러
   - ok — 정상 흐름 (revalidatePath 호출)
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminClaims: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { updateBizInquiryStatus } from './actions';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

const getAdminClaimsMock = vi.mocked(getAdminClaims);
const createClientMock = vi.mocked(createRouteHandlerClient);
const revalidatePathMock = vi.mocked(revalidatePath);

const ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_CLAIMS = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'admin@example.com',
  metadata: {},
  role: 'admin' as const,
  adminLevel: 'staff' as const,
  displayName: null,
  title: null,
};

function makeSupabaseStub(updateError: { code: string; message: string } | null) {
  const eq = vi.fn(async () => ({ error: updateError }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { stub: { from } as unknown as Awaited<ReturnType<typeof createRouteHandlerClient>>, from, update, eq };
}

describe('updateBizInquiryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });
  afterAll(() => vi.resetAllMocks());

  it('unauthorized — getAdminClaims null', async () => {
    getAdminClaimsMock.mockResolvedValueOnce(null);
    const res = await updateBizInquiryStatus({ id: ID, status: 'contacted' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — invalid uuid', async () => {
    const res = await updateBizInquiryStatus({ id: 'nope', status: 'contacted' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });

  it('validation_failed — invalid status', async () => {
    const res = await updateBizInquiryStatus({
      id: ID,
      status: 'archived' as unknown as 'closed',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });

  it('server_error — UPDATE 에러', async () => {
    const { stub } = makeSupabaseStub({ code: 'XX000', message: 'pg boom' });
    createClientMock.mockResolvedValueOnce(stub);
    const res = await updateBizInquiryStatus({ id: ID, status: 'closed' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('server_error');
  });

  it('ok — 정상 흐름 + revalidatePath', async () => {
    const { stub, from, update, eq } = makeSupabaseStub(null);
    createClientMock.mockResolvedValueOnce(stub);
    const res = await updateBizInquiryStatus({ id: ID, status: 'contacted' });
    expect(res.ok).toBe(true);
    expect(from).toHaveBeenCalledWith('biz_inquiries');
    expect(update).toHaveBeenCalledWith({ status: 'contacted' });
    expect(eq).toHaveBeenCalledWith('id', ID);
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/biz-inquiries');
  });
});
