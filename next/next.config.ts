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

  // Server Action body 크기 한도 — 기본 1MB → 6MB 상향 (S167 J-4 fix).
  // 굿데이즈 갤러리 업로드 등 어드민 이미지 multipart upload 가 5MB 한도까지 허용되며,
  // FormData 인코딩 오버헤드 + base64 변환 마진을 위해 6MB 로 설정.
  // Storage 버킷 측 file_size_limit (5MB, 028 마이그레이션) 가 최종 가드.
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },

  // Cache Components (PPR) 활성화 (BUG-006 D-011, Stage C, 2026-04-24):
  //   모든 페이지가 기본 dynamic 이 되며, 정적 캐시는 `'use cache'` 디렉티브로 명시.
  //   runtime data access (cookies/headers/params/searchParams) 는 <Suspense> 경계 필수.
  //   네비게이션 시 이전 라우트를 React Activity 로 "hidden" 상태 보존 → state 유지.
  //   참조: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md
  cacheComponents: true,

  // Version Skew Protection (S294, 2026-05-28):
  //   배포 직후 일정 시간 footer 영역이 비정상적으로 늘어나는 회귀 보고. cacheComponents
  //   + Vercel 자동 배포 환경에서 사용자 browser cache 의 이전 HTML 이 새 deployment
  //   의 CSS/JS chunks 를 요청 → 404 또는 mismatch → 일부 CSS 규칙 누락 → layout 깨짐.
  //   deploymentId 설정 시 Next.js 가 dpl=<id> 쿼리 + x-deployment-id 헤더로 mismatch
  //   감지 → 자동 hard reload (full page) → 일관 deployment chunks 강제.
  //   VERCEL_DEPLOYMENT_ID 는 Vercel 자동 주입 (Build & Runtime 양쪽).
  //   다층 방어: Vercel Dashboard → Settings → Advanced → Skew Protection 도 활성화.
  //   참조: https://nextjs.org/docs/app/guides/self-hosting#version-skew
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,

  // SRI 비활성화 (BUG-006 D-010, 2026-04-23):
  //   Stage B Preview QA 에서 Turbopack + experimental.sri 조합 버그 발견 —
  //   HTML 의 integrity 값과 실제 chunk SHA-256 이 불일치하여 브라우저가 chunk
  //   차단 ("Failed to find a valid digest in the 'integrity' attribute").
  //   공급망 방어는 Next.js 생태계 표준(Vercel/nextjs.org/Linear 모두 SRI 미사용)
  //   + Vercel 자체 CDN 무결성에 의존. D-007 운영 조건 #3 취소.

  // next/image 최적화 설정 (S121, 2026-05-01):
  //   - formats: AVIF 우선 협상 → WebP fallback (Safari 16+ AVIF 지원)
  //   - deviceSizes: GTR 반응형 브레이크포인트 (360/768/1024/1440 + 1920 고DPI)
  //   - imageSizes: 작은 fixed 사이즈 (아이콘·썸네일)
  //   - qualities: Next.js 16 부터 필수 (allowlist 외 요청 시 400) — 75 기본 + 85 hero
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 768, 1024, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85],
    /* Supabase Storage public URL 허용 (S129 H-5 시즌 배너 + 향후 admin 업로드 이미지) */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    /* Dev only — next/image 변환 스킵 (원본 fetch). 변환 race / Turbopack 호환성 회피 (S198).
       production 빌드에서는 false 가 되어 AVIF/WebP/responsive 정상 적용. */
    unoptimized: process.env.NODE_ENV === 'development',
  },

  async headers() {
    return [
      {
        // 모든 경로에 정적 보안 헤더 적용
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // S294 version skew 차단 (다층 방어 #2):
        //   HTML / RSC payload / API 응답에 must-revalidate 강제 → 사용자 browser /
        //   Vercel CDN 의 stale HTML 이 새 deployment 의 chunks 와 mismatch 일으키는
        //   회귀 (footer 영역 비정상 늘어남) 거의 차단. 브라우저는 304 로 cache 재사용
        //   가능 — latency 영향 적음 (서버 prerender ~50ms).
        //   _next/static / _next/image / favicon / images / fonts / monitoring 은 제외:
        //   filename hash 포함된 immutable assets / 정적 자산 / Sentry tunnel.
        //   참조: https://nextjs.org/docs/app/guides/self-hosting#version-skew
        source: "/((?!_next/static|_next/image|favicon|images|fonts|monitoring).*)",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
        ],
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
