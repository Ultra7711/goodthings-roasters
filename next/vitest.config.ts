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
    },
  },
});
