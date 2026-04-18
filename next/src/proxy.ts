/* ══════════════════════════════════════════════════════════════════════════
   proxy.ts — Next.js 16 Proxy (구 middleware.ts)

   역할 (Defense in depth §1.3):
   1. Supabase SSR 세션 쿠키 리프레시 (만료 전 자동 갱신)
      - auth.getUser() 호출이 리프레시 트리거 — 절대 제거 금지
      - 서버 컴포넌트에서 재호출해도 캐시 히트로 비용 없음
   2. 요청별(per-request) Nonce 기반 Content-Security-Policy 주입
      - 'unsafe-inline' 회피, strict-dynamic 으로 번들 스크립트 허용
      - TossPayments / Daum Postcode / OAuth provider 엔드포인트 허용
      - Supabase WSS (Realtime) 허용
   3. 인증 리다이렉트는 proxy 에서 하지 않음
      - 각 Server Component / Route Handler 에서 getClaims() 기반 판정
      - proxy 는 세션 수명 관리 + 전역 보안 헤더만 담당 (관심사 분리)

   Next.js 16 규격:
   - `middleware.ts` → `proxy.ts` 개명 (CVE-2025-29927 회피 정책의 일환)
   - Edge runtime 미지원 — Node.js 런타임만 허용
   - 서버 컴포넌트에서 nonce 읽기: `(await headers()).get('x-nonce')`

   참조:
   - Next.js 16 upgrade: https://nextjs.org/docs/app/guides/upgrading/version-16
   - CSP with Nonce:    https://nextjs.org/docs/app/guides/content-security-policy
   - Supabase SSR:      https://supabase.com/docs/guides/auth/server-side/nextjs
   ══════════════════════════════════════════════════════════════════════════ */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session 8 보안 #2 (docs/payments-security-hardening.md §3): 결제 트랜잭션 경로 전용
 * Referrer-Policy 오버라이드 목록. `same-origin` 으로 축소해 3rd-party 스크립트
 * (GTM / GA4 / 광고 픽셀) 에 `order_number` 가 Referer 헤더로 누출되는 것을 차단.
 *
 * 전역 기본값 (next.config.ts): `strict-origin-when-cross-origin`.
 * 이 경로들에서만 `same-origin` 으로 축소 — 내부 탐색 분석은 유지.
 */
const PAYMENT_SENSITIVE_PATH_PREFIXES = [
  '/checkout',
  '/order-complete',
  '/orders/lookup',
  '/api/payments/',
  '/api/orders/guest-lookup',
] as const;

export function shouldOverrideReferrerPolicy(pathname: string): boolean {
  return PAYMENT_SENSITIVE_PATH_PREFIXES.some((prefix) => {
    /* prefix 자체가 `/`로 끝나면(예: '/api/payments/') 하위 경로만 허용 */
    if (prefix.endsWith('/')) return pathname.startsWith(prefix);
    /* 그 외: 정확 매치 혹은 경로 경계(`/`) subpath */
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

/**
 * CSP 구성 — 허용 오리진은 단일 출처에서 관리.
 * 서드파티 추가/삭제 시 이 함수만 수정하면 proxy 전체가 일관성 유지.
 */
function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  // strict-dynamic: nonce 가 부여된 초기 스크립트가 로드하는 후속 스크립트를 자동 신뢰
  //                 → 번들 스플리팅/동적 import 대응
  // unsafe-eval:    dev 에서만 (React Fast Refresh / sourcemap 진단 용)
  // style-src 'unsafe-inline' (nonce 미사용):
  //   CSP3 에서 nonce 와 'unsafe-inline' 공존 시 'unsafe-inline' 이 무시되어
  //   React 의 style={{...}} (style attribute) 가 전부 거부됨. style attribute 에는
  //   nonce 를 부여할 수 없으므로 style-src 는 nonce 없이 'unsafe-inline' 만 허용.
  //   Next.js 공식 CSP 가이드 · 업계 표준과 일치 (script-src 와 달리 style
  //   inline 은 XSS 영향 제한적).
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://js.tosspayments.com https://pay.toss.im https://dapi.kakao.com https://t1.daumcdn.net`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://t1.daumcdn.net`,
    `img-src 'self' blob: data: https://*.supabase.co https://*.tosspayments.com https://*.daumcdn.net https://postfiles.pstatic.net`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    // Supabase: HTTPS REST + WSS Realtime / TossPayments: 결제 API / Resend: 메일 트리거
    // OAuth providers: kakao/naver/google 토큰 교환
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.tosspayments.com https://pay.toss.im https://api.resend.com https://dapi.kakao.com https://openapi.naver.com https://accounts.google.com`,
    `frame-src 'self' https://*.tosspayments.com https://pay.toss.im https://t1.daumcdn.net https://postcode.map.daum.net https://postcode.map.kakao.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // OAuth 로그인 폼 submit 대상 (provider 인증 엔드포인트)
    `form-action 'self' https://accounts.google.com https://nid.naver.com https://kauth.kakao.com`,
    // X-Frame-Options: DENY 와 동일 — iframe 임베드 전면 차단 (중복 시 frame-ancestors 우선)
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join('; ');
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const isDev = process.env.NODE_ENV === 'development';

  /* ── 1. per-request Nonce 생성 ─────────────────────────────────────────
     Node.js 20+ 전역 crypto.randomUUID() → base64 (22자 내외)
     UUID 는 122 bits of entropy — CSP nonce 권고(>=128 bits) 를 근사 충족.
     추가 안전성 필요 시 Uint8Array(16) + getRandomValues 로 교체 가능. */
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  /* ── 2. 요청 헤더에 nonce · CSP 주입 ───────────────────────────────────
     서버 컴포넌트에서 `(await headers()).get('x-nonce')` 로 읽어
     inline <script nonce={...}> 에 전달할 수 있다. */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const csp = buildContentSecurityPolicy(nonce, isDev);
  requestHeaders.set('Content-Security-Policy', csp);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  /* ── 3. Supabase SSR 세션 리프레시 ─────────────────────────────────────
     getAll/setAll 패턴 — 공식 권장. 구형 get/set/remove 는 세션 유실 위험.
     setAll 내부에서 request·response 쿠키를 동시에 업데이트해야 다음 단계
     (auth.getUser) 가 갱신된 쿠키로 서명 검증을 수행할 수 있다. */
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: createServerClient 와 auth.getUser() 사이에 다른 로직을 두지 말 것.
  //            사이에 await 가 들어가면 쿠키 타이밍 이슈로 사용자가 임의 로그아웃됨.
  //            (Supabase 공식 가이드 경고 그대로 수용)
  await supabase.auth.getUser();

  /* ── 4. 응답 헤더에 CSP 주입 ───────────────────────────────────────────
     정적 보안 헤더 (HSTS·COOP·CORP 등) 는 next.config.ts headers() 가 담당.
     CSP 만 per-request 라 여기서 동적 주입. */
  supabaseResponse.headers.set('Content-Security-Policy', csp);

  /* ── 5. 결제 경로 Referrer-Policy 축소 (Session 8 보안 #2) ─────────────
     3rd-party 분석/광고 태그에 order_number 누출 방어. 전역은
     strict-origin-when-cross-origin 유지, 민감 경로만 same-origin 으로 축소. */
  if (shouldOverrideReferrerPolicy(request.nextUrl.pathname)) {
    supabaseResponse.headers.set('Referrer-Policy', 'same-origin');
  }

  return supabaseResponse;
}

/**
 * proxy 가 실행되지 않을 경로:
 *  - Next.js 내부 자산 (_next/static, _next/image)
 *  - favicon 및 루트 정적 이미지
 * API 와 페이지는 포함 — Route Handler 도 세션 리프레시 대상이며
 * API 응답의 CSP 는 브라우저가 무시하지만 OPTIONS/프리플라이트 일관성에 이득.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
