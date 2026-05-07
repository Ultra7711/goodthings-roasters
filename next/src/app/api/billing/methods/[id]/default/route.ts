/* ══════════════════════════════════════════════════════════════════════════
   /api/billing/methods/[id]/default — default 카드 변경 (Phase 3-A · ADR-008 §3.4)

   POST : 지정 카드를 default 로 변경 (042 RPC `set_default_billing_method`)

   설계:
   - 회원만, 본인 카드만 (billingService 내 user_id 검증)
   - partial unique index 보호 하 두 UPDATE 트랜잭션
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/errors';
import { enforceSameOrigin } from '@/lib/api/csrf';
import { checkRateLimit } from '@/lib/auth/rateLimit';
import { getClaims } from '@/lib/auth/getClaims';
import {
  setDefaultBillingMethod,
  BillingServiceError,
} from '@/lib/services/billingService';

const ID_SCHEMA = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const forbidden = enforceSameOrigin(request);
  if (forbidden) return forbidden;

  const limited = await checkRateLimit(request, 'cart_write');
  if (limited) return limited;

  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const { id } = await context.params;
  const idParsed = ID_SCHEMA.safeParse(id);
  if (!idParsed.success) {
    return apiError('validation_failed', { detail: 'invalid_id' });
  }

  try {
    await setDefaultBillingMethod({
      billingMethodId: idParsed.data,
      userId: claims.userId,
    });
    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof BillingServiceError) {
      switch (err.code) {
        case 'billing_method_not_found':
          return apiError('not_found');
        default:
          return apiError('server_error');
      }
    }
    console.error('[billing.methods.default.POST] unexpected', {
      ...(process.env.NODE_ENV !== 'production' && {
        msg: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      }),
    });
    return apiError('server_error');
  }
}
