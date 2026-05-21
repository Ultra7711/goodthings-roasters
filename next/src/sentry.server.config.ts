import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /* production sample rate 0.1 — S244 진단 후 1.0 → 0.1 하향.
     RSC render / Server Action / API route 매 transaction 마다 Sentry 통신 →
     Active CPU 비용 큼. 트래픽 늘면 0.05 까지 추가 하향 검토. */
  tracesSampleRate: 0.1,
  /* production 외에서는 수집 비활성화 */
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
