/* ══════════════════════════════════════════════════════════════════════════
   notifications.test.ts — fetchAdminNotifications 집계 unit test

   커버리지:
   - 정상 집계 — 4 항목 count + total + label/href 매핑
   - 전부 0 — total 0
   - count 에러 — 해당 항목 0 fallback (다른 항목 정상)
   ══════════════════════════════════════════════════════════════════════════ */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { fetchAdminNotifications } from './notifications';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const getSupabaseAdminMock = vi.mocked(getSupabaseAdmin);

type CountMap = {
  paid: number | null;
  refund: number | null;
  untracked: number | null;
  biz: number | null;
};

type CountResult = { count: number | null; error: { code: string } | null };

/** orders/biz_inquiries head:true count 체인 stub.
 *  from(table) → select → eq(status) [→ is(untracked)] → await {count,error}. */
function makeAdminStub(
  counts: CountMap,
  errors: Partial<Record<keyof CountMap, { code: string }>> = {},
) {
  function builder(table: string) {
    let status = '';
    let untracked = false;
    const node = {
      select: () => node,
      eq: (_col: string, val: string) => {
        status = val;
        return node;
      },
      is: () => {
        untracked = true;
        return node;
      },
      then: (resolve: (r: CountResult) => void) => {
        let key: keyof CountMap;
        if (table === 'biz_inquiries') key = 'biz';
        else if (status === 'paid') key = 'paid';
        else if (status === 'refund_requested') key = 'refund';
        else key = 'untracked'; // shipping + is(null)
        resolve({ count: counts[key], error: errors[key] ?? null });
        void untracked;
      },
    };
    return node;
  }
  const from = vi.fn((table: string) => builder(table));
  return { from } as unknown as ReturnType<typeof getSupabaseAdmin>;
}

describe('fetchAdminNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('정상 집계 — 4 항목 count + total + 매핑', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ paid: 3, refund: 1, untracked: 0, biz: 2 }),
    );

    const result = await fetchAdminNotifications();

    expect(result.total).toBe(6);
    expect(result.items).toHaveLength(4);

    const byKey = Object.fromEntries(result.items.map((i) => [i.key, i]));
    expect(byKey.new_orders).toMatchObject({
      count: 3,
      label: '발송 대기 주문',
      href: '/admin/orders?status=new',
    });
    expect(byKey.refund_requested).toMatchObject({
      count: 1,
      href: '/admin/orders?status=refund_requested',
    });
    expect(byKey.untracked).toMatchObject({
      count: 0,
      href: '/admin/orders?status=untracked',
    });
    expect(byKey.new_biz).toMatchObject({
      count: 2,
      href: '/admin/biz-inquiries?status=pending',
    });
  });

  it('전부 0 — total 0', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub({ paid: 0, refund: 0, untracked: 0, biz: 0 }),
    );

    const result = await fetchAdminNotifications();
    expect(result.total).toBe(0);
  });

  it('count 에러 — 해당 항목 0 fallback, 나머지 정상', async () => {
    getSupabaseAdminMock.mockReturnValue(
      makeAdminStub(
        { paid: null, refund: 4, untracked: 0, biz: 0 },
        { paid: { code: 'XX000' } },
      ),
    );

    const result = await fetchAdminNotifications();
    const byKey = Object.fromEntries(result.items.map((i) => [i.key, i]));
    expect(byKey.new_orders.count).toBe(0); // 에러 → null → 0
    expect(byKey.refund_requested.count).toBe(4);
    expect(result.total).toBe(4);
  });
});
