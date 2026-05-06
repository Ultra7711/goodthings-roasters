/* ══════════════════════════════════════════════════════════════════════════
   route.test.ts — /api/account/addresses GET·PUT 단위 테스트 (S174)

   커버리지:
   GET
   - 401 unauthorized
   - 200 data: null (등록 없음)
   - 200 data: UserAddress (조회 성공)
   - 500 query error
   PUT
   - 403 CSRF 차단
   - 429 rate limited
   - 401 unauthorized
   - 400 invalid_json
   - 400 validation_failed (phone 형식 위반)
   - 200 UPDATE (기존 default 있음)
   - 201 INSERT (기존 없음, addr2 빈 문자열 → NULL 매핑)
   - 500 update 실패

   Mock 전략:
   - csrf / rateLimit / getClaims / supabaseServer 차단
   - createRouteHandlerClient → chained query stub 반환
   ══════════════════════════════════════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api/csrf', () => ({
  enforceSameOrigin: vi.fn(() => null),
}));

vi.mock('@/lib/auth/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => null),
}));

vi.mock('@/lib/auth/getClaims', () => ({
  getClaims: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  createRouteHandlerClient: vi.fn(),
}));

import { GET, PUT } from './route';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

const enforceSameOriginMock = vi.mocked(enforceSameOrigin);
const checkRateLimitMock = vi.mocked(checkRateLimit);
const getClaimsMock = vi.mocked(getClaims);
const createRouteHandlerClientMock = vi.mocked(createRouteHandlerClient);

const USER_ID = '11111111-1111-1111-1111-111111111111';
const VALID_BODY = {
  name: '김철수',
  phone: '010-1234-5678',
  zipcode: '06234',
  addr1: '서울특별시 강남구 테헤란로 123',
  addr2: '101동 202호',
};

/* ── chained query stub ────────────────────────────────────────────────
   from()/select()/eq()/insert()/update() 가 모두 자기자신을 반환하여
   체이닝 가능. maybeSingle/single 만 실제 결과 반환. */
type QueryStub = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function makeQueryStub(): QueryStub {
  const stub: Partial<QueryStub> = {};
  stub.from = vi.fn(() => stub);
  stub.select = vi.fn(() => stub);
  stub.eq = vi.fn(() => stub);
  stub.insert = vi.fn(() => stub);
  stub.update = vi.fn(() => stub);
  stub.maybeSingle = vi.fn();
  stub.single = vi.fn();
  return stub as QueryStub;
}

let queryStub: QueryStub;

function makePutRequest(body: unknown): Request {
  return new Request('https://goodthings-roasters.com/api/account/addresses', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      origin: 'https://goodthings-roasters.com',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  enforceSameOriginMock.mockReturnValue(null);
  checkRateLimitMock.mockResolvedValue(null);
  getClaimsMock.mockResolvedValue({
    userId: USER_ID,
    email: 'a@b.c',
  } as Awaited<ReturnType<typeof getClaims>>);

  queryStub = makeQueryStub();
  createRouteHandlerClientMock.mockResolvedValue(
    queryStub as unknown as Awaited<
      ReturnType<typeof createRouteHandlerClient>
    >,
  );
});

/* ════════════════════════════════════════════════════════════════════ */

describe('GET /api/account/addresses', () => {
  it('401 — 미인증', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 — 등록된 default address 없음 → data: null', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toBeNull();
  });

  it('200 — UserAddress 반환 (addr2 NULL → 빈 문자열 매핑)', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({
      data: {
        name: '김철수',
        phone: '010-1234-5678',
        zipcode: '06234',
        addr1: '서울특별시 강남구 테헤란로 123',
        addr2: null,
      },
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { name: string; addr2: string };
    };
    expect(body.data.name).toBe('김철수');
    expect(body.data.addr2).toBe('');
  });

  it('500 — query 실패', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST', message: 'boom' },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

/* ════════════════════════════════════════════════════════════════════ */

describe('PUT /api/account/addresses', () => {
  it('CSRF 차단 → 403', async () => {
    enforceSameOriginMock.mockReturnValueOnce(
      new Response('{}', { status: 403 }),
    );
    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it('Rate Limit → 429 + cart_write 프리셋 사용', async () => {
    checkRateLimitMock.mockResolvedValueOnce(
      new NextResponse('{}', { status: 429 }),
    );
    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      'cart_write',
    );
  });

  it('401 — 미인증', async () => {
    getClaimsMock.mockResolvedValueOnce(null);
    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it('400 — invalid_json', async () => {
    const res = await PUT(makePutRequest('not-json'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; detail?: string };
    expect(body.detail).toBe('invalid_json');
  });

  it('400 — validation_failed (phone 형식 위반)', async () => {
    const res = await PUT(makePutRequest({ ...VALID_BODY, phone: '@@@' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; fields: unknown };
    expect(body.error).toBe('validation_failed');
    expect(body.fields).toBeDefined();
  });

  it('200 — 기존 default 존재 → UPDATE', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({
      data: { id: 'addr-id-1' },
      error: null,
    });
    queryStub.single.mockResolvedValueOnce({
      data: {
        name: VALID_BODY.name,
        phone: VALID_BODY.phone,
        zipcode: VALID_BODY.zipcode,
        addr1: VALID_BODY.addr1,
        addr2: VALID_BODY.addr2,
      },
      error: null,
    });

    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(queryStub.update).toHaveBeenCalledTimes(1);
    expect(queryStub.insert).not.toHaveBeenCalled();
    const body = (await res.json()) as { data: { name: string } };
    expect(body.data.name).toBe(VALID_BODY.name);
  });

  it('201 — 기존 없음 → INSERT (addr2 빈 문자열 → NULL)', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    queryStub.single.mockResolvedValueOnce({
      data: {
        name: VALID_BODY.name,
        phone: VALID_BODY.phone,
        zipcode: VALID_BODY.zipcode,
        addr1: VALID_BODY.addr1,
        addr2: null,
      },
      error: null,
    });

    const res = await PUT(makePutRequest({ ...VALID_BODY, addr2: '' }));
    expect(res.status).toBe(201);
    expect(queryStub.insert).toHaveBeenCalledTimes(1);

    /* INSERT payload — addr2 빈 문자열이 NULL 로 변환되었는지 검증 */
    const insertCall = queryStub.insert.mock.calls[0]?.[0] as {
      addr2: string | null;
      is_default: boolean;
      user_id: string;
    };
    expect(insertCall.addr2).toBeNull();
    expect(insertCall.is_default).toBe(true);
    expect(insertCall.user_id).toBe(USER_ID);
  });

  it('500 — select 단계 실패', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST', message: 'boom' },
    });
    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });

  it('500 — update 단계 실패', async () => {
    queryStub.maybeSingle.mockResolvedValueOnce({
      data: { id: 'addr-id-1' },
      error: null,
    });
    queryStub.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST', message: 'boom' },
    });
    const res = await PUT(makePutRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
