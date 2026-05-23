import { defineConfig, devices } from '@playwright/test';

/**
 * S262 Phase 4 — Dead CSS sweep 회귀 검증용 smoke E2E.
 *
 * webServer 는 dev 서버를 자동으로 띄움 (이미 띄워있으면 reuseExistingServer).
 * Turbopack 첫 컴파일 시간 고려해 timeout 넉넉히.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // dev 모드 직렬 (메모리·turbopack 안정성)
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // Turbopack 첫 컴파일 + Next.js 16 init
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
