/* ══════════════════════════════════════════════════════════════════════════
   global-teardown.ts — Playwright globalTeardown (S264-D LOW-C)

   책임:
   - .auth/admin.json 정리 (다음 실행을 위해 fresh storageState 강제)
   - E2E 임시 product (E2E_PRODUCT_SLUG) 잔존 보호 — spec 의 afterAll 이
     실패해서 남았을 경우를 대비한 추가 cleanup

   spec 측 afterAll 이 정상 작동하면 본 teardown 은 idempotent 동작 (no-op).
   ══════════════════════════════════════════════════════════════════════════ */

import path from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import {
  E2E_PRODUCT_SLUG,
  cleanupTestProduct,
} from './fixtures/product-seed';

export default async function globalTeardown(): Promise<void> {
  loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });
  loadDotenv({ path: path.resolve(__dirname, '../../.env') });

  const storageStatePath = path.resolve(__dirname, '.auth/admin.json');
  if (existsSync(storageStatePath)) {
    try {
      rmSync(storageStatePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[e2e globalTeardown] storageState 정리 실패: ${msg}`);
    }
  }

  /* product 잔존 정리 — spec afterAll 이 실패했을 때 보호 */
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  try {
    /* 잔존 product 가 있는지 조회 — id 모르면 slug 기준 조회 후 cleanup */
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await admin
      .from('products')
      .select('id, slug')
      .eq('slug', E2E_PRODUCT_SLUG)
      .maybeSingle();
    if (data) {
      await cleanupTestProduct({ id: data.id, slug: data.slug });
      console.log(
        `[e2e globalTeardown] 잔존 E2E product 정리 완료 (slug=${E2E_PRODUCT_SLUG})`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[e2e globalTeardown] product 정리 실패: ${msg}`);
  }
}
