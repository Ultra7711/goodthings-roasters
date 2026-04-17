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
  /* 의도적으로 getClaims + isAdmin 을 분리 호출하여 401(비인증) / 403(비admin)
     구분 유지. `getAdminClaims()` 는 두 케이스를 모두 null 로 반환하므로 여기선 사용 안 함. */
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
