import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * 정적 보안 헤더 — 모든 응답에 자동 첨부.
 * CSP 는 요청별 Nonce 가 필요하므로 proxy.ts 에서 동적 주입한다.
 *
 * 참조: docs/backend-architecture-plan.md §5.3
 */
const SECURITY_HEADERS = [
  // HSTS: 2년 + preload 대기열 등록 (프로덕션 HTTPS 전용)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // MIME 스니핑 차단 — 서버 Content-Type 신뢰 강제
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer: 크로스 오리진 → origin 만, 같은 오리진 → 전체 URL
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 민감 API 차단 + payment=(self) — TossPayments Web Payment API 허용
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=(), payment=(self)",
  },
  // COOP: same-origin-allow-popups — OAuth 팝업(Google/Kakao/Naver) window.opener 유지
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // CORP: same-site — 외부 사이트가 우리 리소스를 fetch/embed 하는 것 차단
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  // X-Frame-Options 미설정 — CSP frame-ancestors 'none' 으로 대체 (중복 시 frame-ancestors 우선)
];

const nextConfig: NextConfig = {
  // Turbopack workspace root 를 next/ 로 고정.
  // 상위 디렉터리(goodthings-roasters/)에 package-lock.json 이 존재할 수 있어
  // (supabase CLI 등 repo-level devDeps) 자동 추론이 루트를 잘못 선택하는 문제 회피.
  turbopack: {
    root: path.join(__dirname),
  },

  // @node-rs/argon2 는 native binary 를 포함하므로 서버 번들에서 제외한다.
  // Next.js 가 Node.js native 모듈을 webpack 으로 처리하지 않고 런타임에 require 한다.
  serverExternalPackages: ["@node-rs/argon2"],

  // BUG-006 Phase 2B 단계 3 — SRI 기반 CSP 전환 (nonce 대체).
  // 빌드 시 모든 <script> 태그에 integrity="sha256-..." 을 자동 부착.
  // nonce 기반 CSP 와 달리 정적 생성·PPR·cacheComponents 와 병립 가능하다
  // (node_modules/next/dist/docs/.../content-security-policy.md L456-458).
  experimental: {
    sri: {
      algorithm: "sha256",
    },
  },

  async headers() {
    return [
      {
        // 모든 경로에 정적 보안 헤더 적용
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

/* Sentry 래핑 — source map 업로드 + tunnelRoute 로 ad-blocker 우회.
   tunnelRoute 는 브라우저 요청이 /monitoring 로 갔다가 Next.js 서버가
   Sentry ingest 로 프록시 → CSP connect-src 에 Sentry 도메인 추가 불필요. */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "goodthings-roasters",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  /* CI 외 환경에서는 업로드 로그 억제 */
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  /* source map 은 Sentry 에 업로드 후 브라우저에서 숨김 (public → hidden) */
  sourcemaps: {
    disable: false,
  },
});
