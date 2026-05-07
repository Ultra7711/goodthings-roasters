/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/authorizations — 빌링키 발급 (Phase 3-A · ADR-008 §3.4)

   POST : Toss successUrl 콜백의 authKey + customerKey → 빌링키 발급 + INSERT

   설계:
   - 회원만 (게스트 정기배송 불가 — D-5)
   - customer_key 일치 검증은 billingService 내부
   - rate limit: cart_write 재사용 (사용자 UI 조작 빈도)
   - CSRF: enforceSameOrigin
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { apiError, apiSuccess, apiValidationError } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import {
  issueBillingMethod,
  BillingServiceError,
} from '@/lib/services/billingService';

const ISSUE_SCHEMA = z.object({
  authKey: z.string().trim().min(1).max(300),
  // Toss customerKey 형식 (2-300자, [a-zA-Z0-9-_=.@])
  customerKey: z
    .string()
    .trim()
    .min(2)
    .max(300)
    .regex(/^[a-zA-Z0-9._=@-]+$/, 'invalid customerKey format'),
});

export async function POST(request: Request): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('validation_failed', { detail: 'invalid_json' });
  }

  const parsed = ISSUE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await issueBillingMethod({
      authKey: parsed.data.authKey,
      customerKey: parsed.data.customerKey,
      userId: claims.userId,
    });
    return apiSuccess(result, 201);
  } catch (err) {
    if (err instanceof BillingServiceError) {
      switch (err.code) {
        case 'profile_not_found':
          return apiError('unauthorized');
        case 'customer_key_mismatch':
          return apiError('forbidden', { detail: 'customer_key_mismatch' });
        case 'toss_authorization_failed':
          return apiError('payment_failed', { detail: 'authorization_failed' });
        default:
          return apiError('server_error');
      }
    }
    console.error('[billing.authorizations.POST] unexpected', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
}
