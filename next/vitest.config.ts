import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /* `server-only` 는 production 클라 번들 차단 마커.
         vitest 환경에서는 패키지가 resolve 안 돼서 import 자체가 실패하므로 빈 stub 으로 alias.
         (S129 H-5: ordersServer · siteSettingsServer 가 import) */
      'server-only': path.resolve(__dirname, './src/__mocks__/server-only.ts'),
      /* `next/og` 는 ESM-only server module. vitest dependency graph 분석 시
         resolve 못 해 src/ 전체 import (alias 포함) 가 깨진다.
         apple-icon / opengraph-image / twitter-image 는 .test 대상 아니므로 stub. */
      'next/og': path.resolve(__dirname, './src/__mocks__/next-og.ts'),
    },
  },
});
