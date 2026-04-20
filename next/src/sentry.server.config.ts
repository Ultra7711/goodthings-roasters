import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /* 샘플링: 초기엔 전수 수집 후 트래픽 늘면 낮춤 */
  tracesSampleRate: 1.0,
  /* production 외에서는 수집 비활성화 */
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
