/* ══════════════════════════════════════════════════════════════════════════
   /api/account/addresses — 회원 기본 배송지 (S174)

   GET  : 로그인 사용자의 기본 배송지(is_default=true) 1건 조회
   PUT  : 기본 배송지 upsert (있으면 UPDATE, 없으면 INSERT)

   설계:
   - 1 사용자 : 1 default address 정책 (002 부분 유니크 제약 활용).
     N개 주소 관리는 후속 sprint.
   - 인증: getClaims() — 쿠키 기반 사용자 식별
   - 권한: createRouteHandlerClient() + RLS (007_rls_policies.sql)
   - 검증: zod (002 테이블 check 제약 매칭 — phone/zipcode regex, name/addr 길이)
   - addr2 빈 문자열 → NULL 변환 (002 check: addr2 NULL or 1~200자)

   응답 포맷 (errors.ts §7.4):
   - GET 200 : { data: UserAddress | null }
   - PUT 200 : { data: UserAddress }
   - 400 validation_failed
   - 401 unauthorized
   - 429 rate_limited (PUT 만, cart_write 프리셋 재사용)
   - 500 server_error
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import type { UserAddress } from '@/types/address';

/* ── 검증 스키마 — 002_addresses.sql check 제약과 1:1 매칭 ── */
const ADDRESS_SCHEMA = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, '이름을 입력해 주세요.').max(80)),
  phone: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .regex(/^\+?[0-9\-\s]{9,20}$/, '올바른 전화번호 형식을 입력해 주세요.'),
    ),
  zipcode: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().regex(/^[0-9]{5}$/, '우편번호는 5자리 숫자입니다.')),
  addr1: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, '주소를 입력해 주세요.').max(200)),
  addr2: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(200))
    .default(''),
});

/* ── DB row → UserAddress 매핑 (addr2 NULL → '') ── */
type AddressRow = {
  name: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2: string | null;
};

function rowToUserAddress(row: AddressRow): UserAddress {
  return {
    name: row.name,
    phone: row.phone,
    zipcode: row.zipcode,
    addr1: row.addr1,
    addr2: row.addr2 ?? '',
  };
}

/* ══════════════════════════════════════════ */
export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('addresses')
    .select('name, phone, zipcode, addr1, addr2')
    .eq('user_id', claims.userId)
    .eq('is_default', true)
    .maybeSingle<AddressRow>();

  if (error) {
    console.error('[account.addresses.GET] query failed', {
      code: error.code,
      ...(process.env.NODE_ENV !== 'production' && {
        msg: (error.message ?? '').slice(0, 200),
      }),
    });
    return apiError('server_error');
  }

  return apiSuccess(data ? rowToUserAddress(data) : null);
}

/* ══════════════════════════════════════════ */
export async function PUT(request: Request): Promise<Response> {
  /* 1) CSRF */
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  /* 2) Rate Limit — cart_write 재사용 (사용자 UI 조작 빈도 보호) */
  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  /* 3) 인증 */
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  /* 4) 본문 파싱 */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }

  const parsed = ADDRESS_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.flatten().fieldErrors);
  }

  const { name, phone, zipcode, addr1, addr2 } = parsed.data;
  const supabase = await createRouteHandlerClient();

  /* 5) 기존 default address 조회 */
  const { data: existing, error: selectError } = await supabase
    .from('addresses')
    .select('id')
    .eq('user_id', claims.userId)
    .eq('is_default', true)
    .maybeSingle<{ id: string }>();

  if (selectError) {
    console.error('[account.addresses.PUT] select failed', {
      code: selectError.code,
      ...(process.env.NODE_ENV !== 'production' && {
        msg: (selectError.message ?? '').slice(0, 200),
      }),
    });
    return apiError('server_error');
  }

  /* 6) addr2 빈 문자열 → NULL (002 check 제약) */
  const addr2OrNull = addr2.length > 0 ? addr2 : null;

  /* 7) UPDATE or INSERT */
  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('addresses')
      .update({
        name,
        phone,
        zipcode,
        addr1,
        addr2: addr2OrNull,
      })
      .eq('id', existing.id)
      .select('name, phone, zipcode, addr1, addr2')
      .single<AddressRow>();

    if (updateError || !updated) {
      console.error('[account.addresses.PUT] update failed', {
        code: updateError?.code,
        ...(process.env.NODE_ENV !== 'production' && {
          msg: (updateError?.message ?? '').slice(0, 200),
        }),
      });
      return apiError('server_error');
    }

    return apiSuccess(rowToUserAddress(updated));
  }

  /* INSERT — is_default=true (002 부분 유니크 제약: 사용자당 1개만 허용) */
  const { data: inserted, error: insertError } = await supabase
    .from('addresses')
    .insert({
      user_id: claims.userId,
      name,
      phone,
      zipcode,
      addr1,
      addr2: addr2OrNull,
      is_default: true,
    })
    .select('name, phone, zipcode, addr1, addr2')
    .single<AddressRow>();

  if (insertError || !inserted) {
    console.error('[account.addresses.PUT] insert failed', {
      code: insertError?.code,
      ...(process.env.NODE_ENV !== 'production' && {
        msg: (insertError?.message ?? '').slice(0, 200),
      }),
    });
    return apiError('server_error');
  }

  return apiSuccess(rowToUserAddress(inserted), 201);
}
