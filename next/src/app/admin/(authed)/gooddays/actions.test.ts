/* ══════════════════════════════════════════════════════════════════════════
   actions.test.ts — /admin/gooddays Server Action 단위 테스트 (S167 J-4)

   커버리지:
   - unauthorized — getAdminClaims null
   - validation_failed — invalid uuid / empty file / file too large
   - not_found — DB row 미존재
   - ok — update / reorder / delete 정상

   Note: upload action 은 plaiceholder (sharp wasm) 의존이라 vitest jsdom
   환경에서 실제 호출은 stub 처리. validation 분기만 테스트.
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminClaims: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

import {
  deleteGoodDaysImageAction,
  reorderGoodDaysImagesAction,
  updateGoodDaysImageAction,
  uploadGoodDaysImageAction,
} from './actions';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const getAdminClaimsMock = vi.mocked(getAdminClaims);
const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

const VALID_UUID = '11111111-2222-3333-4444-555555555555';

type AdminStubOpts = {
  selectRow?: { id: string; url: string } | null;
  selectError?: { code: string; message: string } | null;
  updateRow?: { id: string } | null;
  updateError?: { code: string; message: string } | null;
  deleteError?: { code: string; message: string } | null;
  storageRemoveError?: { message: string } | null;
};

function makeAdminStub(opts: AdminStubOpts = {}) {
  const maybeSingleSelect = vi.fn(async () => ({
    data: opts.selectRow ?? null,
    error: opts.selectError ?? null,
  }));
  const limitSelect = { maybeSingle: maybeSingleSelect };
  const orderSelect = vi.fn(() => ({ limit: vi.fn(() => limitSelect) }));
  const eqSelect = vi.fn(() => ({ maybeSingle: maybeSingleSelect, select: vi.fn(() => ({})) }));
  const select = vi.fn(() => ({ eq: eqSelect, order: orderSelect }));

  const maybeSingleUpdate = vi.fn(async () => ({
    data: opts.updateRow ?? null,
    error: opts.updateError ?? null,
  }));
  const selectUpdate = vi.fn(() => ({ maybeSingle: maybeSingleUpdate }));
  const eqUpdate = vi.fn(() => ({ select: selectUpdate }));
  const update = vi.fn(() => ({ eq: eqUpdate }));

  const eqDelete = vi.fn(async () => ({ error: opts.deleteError ?? null }));
  const del = vi.fn(() => ({ eq: eqDelete }));

  const from = vi.fn(() => ({ select, update, delete: del }));

  const remove = vi.fn(async () => ({
    data: null,
    error: opts.storageRemoveError ?? null,
  }));
  const storage = {
    from: vi.fn(() => ({ remove })),
  };

  return { from, storage } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

const ADMIN_CLAIMS = { userId: 'admin-uuid-1', email: 'admin@example.com' } as Awaited<
  ReturnType<typeof getAdminClaims>
>;

describe('uploadGoodDaysImageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  afterAll(() => vi.resetAllMocks());

  it('unauthorized — getAdminClaims null', async () => {
    getAdminClaimsMock.mockResolvedValueOnce(null);
    const fd = new FormData();
    const result = await uploadGoodDaysImageAction(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('validation_failed — file 누락', async () => {
    const fd = new FormData();
    const result = await uploadGoodDaysImageAction(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
      expect(result.detail).toBe('file_missing');
    }
  });

  it('validation_failed — file_too_large', async () => {
    const fd = new FormData();
    /* 6MB Buffer */
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.webp', {
      type: 'image/webp',
    });
    fd.append('file', big);
    const result = await uploadGoodDaysImageAction(fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('validation_failed');
      expect(result.detail).toBe('file_too_large');
    }
  });
});

describe('updateGoodDaysImageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  it('unauthorized', async () => {
    getAdminClaimsMock.mockResolvedValueOnce(null);
    const result = await updateGoodDaysImageAction({ id: VALID_UUID, alt: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('validation_failed — invalid uuid', async () => {
    const result = await updateGoodDaysImageAction({ id: 'not-uuid', alt: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('validation_failed');
  });

  it('not_found — DB row 미존재', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ updateRow: null, updateError: null }),
    );
    const result = await updateGoodDaysImageAction({ id: VALID_UUID, alt: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
  });

  it('ok — alt 만 있으면 정상 업데이트', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ updateRow: { id: VALID_UUID } }),
    );
    const result = await updateGoodDaysImageAction({ id: VALID_UUID, alt: '새 설명' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe(VALID_UUID);
  });

  it('ok — featured 토글', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ updateRow: { id: VALID_UUID } }),
    );
    const result = await updateGoodDaysImageAction({ id: VALID_UUID, featured: true });
    expect(result.ok).toBe(true);
  });

  it('ok — 변경 없음 (모든 필드 undefined) 시 즉시 ok', async () => {
    /* getSupabaseAdmin 호출되지 않아야 함 */
    const stub = makeAdminStub({ updateRow: { id: VALID_UUID } });
    getSupabaseAdminMock.mockReturnValue(stub);
    const result = await updateGoodDaysImageAction({ id: VALID_UUID });
    expect(result.ok).toBe(true);
    expect(stub.from).not.toHaveBeenCalled();
  });
});

describe('reorderGoodDaysImagesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  it('unauthorized', async () => {
    getAdminClaimsMock.mockResolvedValueOnce(null);
    const result = await reorderGoodDaysImagesAction({ orderedIds: [VALID_UUID] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('validation_failed — 빈 배열', async () => {
    const result = await reorderGoodDaysImagesAction({ orderedIds: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('validation_failed');
  });

  it('validation_failed — invalid uuid 포함', async () => {
    const result = await reorderGoodDaysImagesAction({
      orderedIds: [VALID_UUID, 'bad'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('validation_failed');
  });

  it('ok — 단일 id 정렬', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ updateRow: { id: VALID_UUID } }),
    );
    const result = await reorderGoodDaysImagesAction({ orderedIds: [VALID_UUID] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.count).toBe(1);
  });
});

describe('deleteGoodDaysImageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminClaimsMock.mockResolvedValue(ADMIN_CLAIMS);
  });

  it('unauthorized', async () => {
    getAdminClaimsMock.mockResolvedValueOnce(null);
    const result = await deleteGoodDaysImageAction({ id: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('unauthorized');
  });

  it('validation_failed — invalid uuid', async () => {
    const result = await deleteGoodDaysImageAction({ id: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('validation_failed');
  });

  it('not_found — DB row 미존재', async () => {
    getSupabaseAdminMock.mockReturnValue(makeAdminStub({ selectRow: null }));
    const result = await deleteGoodDaysImageAction({ id: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
  });

  it('ok — Storage delete + DB delete', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        selectRow: { id: VALID_UUID, url: 'https://x.example/foo/bar.webp' },
      }),
    );
    const result = await deleteGoodDaysImageAction({ id: VALID_UUID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe(VALID_UUID);
  });

  it('ok — Storage 삭제 실패해도 DB delete 진행', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({
        selectRow: { id: VALID_UUID, url: 'https://x.example/foo/bar.webp' },
        storageRemoveError: { message: 'storage_unavailable' },
      }),
    );
    const result = await deleteGoodDaysImageAction({ id: VALID_UUID });
    expect(result.ok).toBe(true);
  });
});
