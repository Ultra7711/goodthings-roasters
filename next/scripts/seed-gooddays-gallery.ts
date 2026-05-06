/* ══════════════════════════════════════════════════════════════════════════
   seed-gooddays-gallery.ts — gooddays_gallery 테이블 seed (S167 J-2)

   목적:
     lib/gooddays.ts 의 hardcoded SEED_IMAGES 42장 (featured 6장 포함) 을
     DB 테이블 + Storage 버킷으로 이관.

   처리 흐름:
     1. service_role 클라이언트 생성 (SUPABASE_SERVICE_ROLE_KEY 필수)
     2. 기존 row 존재 시 abort — idempotent 보호
     3. SEED_IMAGES 42장 순서대로:
        a. public/images/gallery/{filename} 읽기
        b. plaiceholder → blur_data_url + width + height 추출
        c. Storage gooddays-images 버킷 upsert (filename 보존)
        d. getPublicUrl → url 컬럼 후보
        e. DB INSERT (sort_order = idx+1, featured = img.featured ?? false)
     4. summary 출력

   실행: npx tsx scripts/seed-gooddays-gallery.ts

   환경변수 필수:
     - NEXT_PUBLIC_SUPABASE_URL
     - SUPABASE_SERVICE_ROLE_KEY (.env.local)

   1회 실행 가정. 재실행 시 row 존재 abort.
   ══════════════════════════════════════════════════════════════════════════ */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getPlaiceholder } from 'plaiceholder';
import { config as loadEnv } from 'dotenv';

/* 42장 hardcoded — 프로토타입 그대로. lib/gooddays.ts 의존 X (S167 J-3 에서 SEED_IMAGES 삭제됨).
   재실행 시 truncate 후 다시 사용 가능하도록 스크립트 자체 데이터 보유. */
type SeedImage = { src: string; featured?: boolean };
const SEED_IMAGES: SeedImage[] = [
  { src: '/images/gallery/KakaoTalk_20260328_161956706_01.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_02.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_03.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_04.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_05.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_06.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_07.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_08.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_09.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_10.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_11.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_12.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_13.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_14.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_15.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_16.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_17.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_18.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_19.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_20.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_21.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_22.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_23.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_24.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_25.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_26.webp', featured: true },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_27.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_28.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_161956706_29.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_02.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_04.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_05.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_06.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_07.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_08.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_09.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_10.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_11.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_12.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_13.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_14.webp' },
  { src: '/images/gallery/KakaoTalk_20260328_162007174_15.webp' },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(NEXT_ROOT, 'public');
const GALLERY_DIR = path.join(PUBLIC_DIR, 'images', 'gallery');
const BUCKET_ID = 'gooddays-images';

loadEnv({ path: path.join(NEXT_ROOT, '.env.local') });

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`[seed] ${key} 미설정 — .env.local 확인`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* 1. 기존 row 존재 확인 — 있으면 abort */
  const { count, error: countErr } = await admin
    .from('gooddays_gallery')
    .select('id', { count: 'exact', head: true });
  if (countErr) {
    console.error('[seed] count failed:', countErr.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error(
      `[seed] gooddays_gallery 에 이미 ${count} rows 존재. ` +
        '재실행 전 truncate 필요. abort.',
    );
    process.exit(1);
  }

  console.log(`[seed] processing ${SEED_IMAGES.length} images...`);

  /* 2. 이미지별 처리 */
  const rows: Array<{
    url: string;
    alt: string;
    sort_order: number;
    is_active: boolean;
    featured: boolean;
    blur_data_url: string;
    width: number;
    height: number;
  }> = [];

  for (let i = 0; i < SEED_IMAGES.length; i++) {
    const img = SEED_IMAGES[i];
    const filename = path.basename(img.src);
    const filePath = path.join(GALLERY_DIR, filename);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch (err) {
      console.error(`[seed] 파일 누락: ${filePath}`);
      throw err;
    }

    const { base64, metadata } = await getPlaiceholder(buffer, { size: 10 });

    /* Storage upsert (filename 키) */
    const { error: uploadErr } = await admin.storage
      .from(BUCKET_ID)
      .upload(filename, buffer, {
        contentType: 'image/webp',
        upsert: true,
      });
    if (uploadErr) {
      console.error(`[seed] Storage upload 실패 (${filename}):`, uploadErr.message);
      throw uploadErr;
    }

    const { data: publicUrlData } = admin.storage
      .from(BUCKET_ID)
      .getPublicUrl(filename);

    rows.push({
      url: publicUrlData.publicUrl,
      alt: '',
      sort_order: i + 1,
      is_active: true,
      featured: img.featured ?? false,
      blur_data_url: base64,
      width: metadata.width,
      height: metadata.height,
    });

    process.stdout.write('.');
  }
  process.stdout.write('\n');

  /* 3. DB INSERT (단일 batch) */
  const { error: insertErr } = await admin.from('gooddays_gallery').insert(rows);
  if (insertErr) {
    console.error('[seed] INSERT 실패:', insertErr.message);
    throw insertErr;
  }

  console.log(`[seed] ✅ ${rows.length} rows 이관 완료`);
  console.log(`[seed]    - featured: ${rows.filter((r) => r.featured).length} 장`);
  console.log(`[seed]    - bucket: ${BUCKET_ID}`);
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
