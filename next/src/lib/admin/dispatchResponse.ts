/* ══════════════════════════════════════════════════════════════════════════
   dispatchResponse.ts — DispatchResult → REST API Response 변환 (S166 PR-1)

   Server Action 은 DispatchResult 를 그대로 return,
   REST API 는 본 helper 로 표준 envelope (apiSuccess / apiError) 변환.
   (ADR-006 §4)
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import type { DispatchResult } from './dispatch';

/**
 * DispatchResult → Route Handler Response 변환.
 *
 * 매핑:
 *   not_found         → 404 apiError('not_found')
 *   illegal_state     → 409 apiError('conflict', { detail: 'illegal_state:{cur}' })
 *   invalid_tracking  → 400 apiError('validation_failed', { detail: 'invalid_tracking' })
 *   validation_failed → 400 apiError('validation_failed', { detail })
 *   server_error      → 500 apiError('server_error')
 */
export function dispatchResultToApiResponse(result: DispatchResult): Response {
  if (result.ok) return apiSuccess(result.data);

  switch (result.error) {
    case 'not_found':
      return apiError('not_found');
    case 'illegal_state':
      return apiError('conflict', {
        detail: `illegal_state:${result.detail ?? ''}`,
      });
    case 'invalid_tracking':
      return apiError('validation_failed', { detail: 'invalid_tracking' });
    case 'validation_failed':
      return apiError('validation_failed', { detail: result.detail });
    case 'server_error':
      return apiError('server_error');
  }
}
