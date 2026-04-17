/* ══════════════════════════════════════════════════════════════════════════
   GET /api/admin/me — admin 역할 확인 스텁 (Session 13, P2-F RBAC)

   목적:
   - 어드민 UI 진입 전 "내가 admin 인가" 확인용 스텁.
   - requireAdmin 가드 패턴 사용 예시 역할.

   응답:
   - 200 { data: { userId, email, role: 'admin' } }
   - 401 unauthorized
   - 403 forbidden (로그인 했으나 비admin)
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError, apiSuccess } from '@/lib/api/errors';
import { getClaims, isAdmin } from '@/lib/auth/getClaims';

export async function GET(): Promise<Response> {
  const claims = await getClaims();
  if (!claims) return apiError('unauthorized');

  const admin = await isAdmin(claims.userId);
  if (!admin) return apiError('forbidden');

  return apiSuccess({
    userId: claims.userId,
    email: claims.email,
    role: 'admin' as const,
  });
}
