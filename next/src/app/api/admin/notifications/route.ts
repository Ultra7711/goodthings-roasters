/* ══════════════════════════════════════════════════════════════════════════
   GET /api/admin/notifications — 어드민 상단 알림 벨 집계

   어드민 UI(브라우저 세션) 채널 — getAdminClaims(쿠키 세션) 가드.
   curl 채널(x-admin-secret)이 아니라 AdminTopbar client fetch 전용.
   집계 SoT = lib/admin/notifications.fetchAdminNotifications (service_role count).
   ══════════════════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { fetchAdminNotifications } from '@/lib/admin/notifications';

export async function GET(): Promise<Response> {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const data = await fetchAdminNotifications(claims.adminLevel);
  return NextResponse.json(data);
}
