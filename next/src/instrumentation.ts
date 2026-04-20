/* Sentry — Next.js 16 서버/엣지 런타임 초기화 진입점.
   런타임 구분은 Sentry 공식 가이드 (docs/platforms/javascript/guides/nextjs/manual-setup). */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/* Server Components / proxy / Route Handlers 에서 발생한 에러를 Sentry 로 전달.
   Next.js 공식 onRequestError 훅. */
export const onRequestError = Sentry.captureRequestError;
