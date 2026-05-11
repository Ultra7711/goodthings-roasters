/* ══════════════════════════════════════════
   /preview/signature — 라이브 미리보기 (S148 PR-2 advisory §6.1 D-1)

   책임:
   - admin 가드 (비admin → /admin/login).
   - URL 파라미터 → SignatureSettings 파싱 (Zod safeParse · 실패 시 DEFAULTS).
   - SignatureChapterView 호출 (메인 페이지와 동일 컴포넌트).
   - 빈 상태 (chapter hide) 시 어드민 시각 디버깅용 placeholder 표시.

   호출:
   - 어드민 SettingsForm iframe src 로만 사용. 외부 임베드는 frame-ancestors 'self'.

   참조: SignatureChapterView · proxy.ts (pathname 분기)
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import {
  SIGNATURE_DEFAULTS,
  SignatureSettingsSchema,
} from '@/lib/siteSettings';
import { fetchProductBySlug } from '@/lib/productsServer';
import SignatureChapterView from '@/components/home/SignatureChapterView';

interface PreviewSignaturePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

export default async function PreviewSignaturePage({
  searchParams,
}: PreviewSignaturePageProps) {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const params = await searchParams;

  /* URL 파라미터 → SignatureSettings 파싱.
     chips 는 '|' 구분 문자열 (chip 안에 '|' 들어가지 않는다 가정). */
  const chipsRaw = asString(params.chips);
  const parsed = SignatureSettingsSchema.safeParse({
    enabled: asString(params.enabled) === 'true',
    eyebrow: asString(params.eyebrow),
    product_slug: asString(params.product_slug),
    title: asString(params.title),
    subtitle: asString(params.subtitle),
    flavor_chips: chipsRaw
      ? chipsRaw.split('|').map((s) => s.trim()).filter(Boolean)
      : [],
    image_path: asString(params.image_path),
    image_alt: asString(params.image_alt),
  });

  const signature = parsed.success ? parsed.data : SIGNATURE_DEFAULTS;

  const product = signature.product_slug
    ? await fetchProductBySlug(signature.product_slug)
    : null;

  /* 빈 상태 — chapter 가 hide 될 조건 (View 가 null 반환).
     어드민 시각 디버깅용 placeholder 표시. */
  const willHide =
    !signature.enabled ||
    !signature.image_path ||
    !signature.product_slug;

  if (willHide) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 360,
            padding: '32px 28px',
            background: 'rgba(28,27,25,0.04)',
            border: '1px dashed rgba(28,27,25,0.2)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-label-on-white)',
              marginBottom: 12,
            }}
          >
            Preview · Hidden
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {!signature.enabled
              ? '시그니처 섹션 비활성 상태 — 활성으로 변경하면 표시됩니다.'
              : !signature.product_slug
                ? '제품을 선택해 주세요.'
                : '이미지를 업로드해 주세요.'}
          </div>
        </div>
      </div>
    );
  }

  return <SignatureChapterView signature={signature} product={product} />;
}
