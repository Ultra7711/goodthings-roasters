/* Sentry — Next.js 16 클라이언트 초기화.
   App Router 에서는 instrumentation-client.ts 가 자동 로드된다
   (구 sentry.client.config.ts 대체). */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  /* dev/preview 에서는 수집 비활성화 — 노이즈 방지 */
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

/* Next.js 16 App Router 내비게이션 추적 훅 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
