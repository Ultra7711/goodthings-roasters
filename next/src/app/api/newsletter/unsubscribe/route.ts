/* ══════════════════════════════════════════
   /api/newsletter/unsubscribe — List-Unsubscribe one-click 엔드포인트 (S250-2 Phase 2)

   발송 메일의 `List-Unsubscribe` / `List-Unsubscribe-Post` 헤더가 가리키는 URL.
   - POST (RFC 8058 one-click): 메일 클라이언트(Gmail/Apple)가 서버-투-서버로 호출.
     쿠키 없음 → unsubscribe_by_token RPC(SECURITY DEFINER · anon 허용)로 처리.
     결과와 무관하게 200 (graceful · 토큰 노출 최소화).
   - GET (RFC 2369 일부 클라이언트): 사람이 브라우저로 열 수 있음 →
     친화적 /unsubscribe?token= 페이지로 리다이렉트 (해당 페이지가 처리 + UI).

   참조: app/(main)/unsubscribe/page.tsx · lib/newsletter.ts unsubscribeByToken.
   ══════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/newsletter';

export async function POST(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  /* graceful — 토큰 불일치/오류여도 200. 결과를 노출하지 않는다. */
  await unsubscribeByToken(token);
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  return NextResponse.redirect(`${origin}/unsubscribe?token=${encodeURIComponent(token)}`);
}
