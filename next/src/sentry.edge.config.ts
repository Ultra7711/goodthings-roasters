import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /* production sample rate 0.1 — S244 진단 후 하향. server.config.ts 와 정합. */
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
