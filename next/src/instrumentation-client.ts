/* Sentry — Next.js 16 클라이언트 초기화.
   App Router 에서는 instrumentation-client.ts 가 자동 로드된다
   (구 sentry.client.config.ts 대체). */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  /* production sample rate 0.1 — Sentry 공식 권장 5~20% (트래픽 늘면 추가 하향).
     1.0 운영 시 tunnelRoute(/monitoring) 경유 Vercel function invocation 폭주
     → Active CPU 비용 증가 확인 (S244 진단). 에러 자체(captureException)는
     본 옵션 영향 받지 않음 — 항상 100% 전송. */
  tracesSampleRate: 0.1,
  /* dev/preview 에서는 수집 비활성화 — 노이즈 방지 */
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

/* Next.js 16 App Router 내비게이션 추적 훅 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
