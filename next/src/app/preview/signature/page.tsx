/* ══════════════════════════════════════════
   /preview/signature — 라이브 미리보기 (S237 iframe 모델 · 062 · S270 Phase 3b)

   책임:
   - admin 가드 (비admin → /admin/login).
   - URL 파라미터 → SignatureBanner 조립 → SignatureBannerSchema safeParse.
   - SignatureChapterView 호출 (메인 페이지와 동일 컴포넌트).
   - 빈 상태 (HTML 또는 desktop 이미지 미입력 등) 시 placeholder.

   호출:
   - SignaturesForm iframe src 로만 사용. 외부 임베드는 frame-ancestors 'self'.

   답습: /preview/cafe-event/page.tsx

   참조:
   - components/home/SignatureChapterView.tsx
   - lib/banners.ts SignatureBannerSchema
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { SignatureBannerSchema } from '@/lib/banners';
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

  /* SignatureBannerSchema 의 id 는 uuid 필수. preview 용 더미 uuid 주입 (실 row 가 아님). */
  const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

  const parsed = SignatureBannerSchema.safeParse({
    id: DUMMY_UUID,
    kind: 'signature',
    enabled: asString(params.enabled) === 'true',
    custom_html_path: asString(params.custom_html_path),
    image_path_desktop: asString(params.image_path_desktop),
    image_path_tablet: asString(params.image_path_tablet),
    image_path_mobile: asString(params.image_path_mobile),
    image_blur_desktop: asString(params.image_blur_desktop),
    image_blur_tablet: asString(params.image_blur_tablet),
    image_blur_mobile: asString(params.image_blur_mobile),
    aspect_desktop: asString(params.aspect_desktop) || '1320/600',
    aspect_tablet: asString(params.aspect_tablet) || '1024/520',
    aspect_mobile: asString(params.aspect_mobile) || '390/520',
    image_alt: asString(params.image_alt),
    headline_text: asString(params.headline_text),
    subhead_text: asString(params.subhead_text),
    cta_text: asString(params.cta_text),
    cta_href: asString(params.cta_href),
    start_date: '',
    end_date: '',
    sort_order: 0,
  });

  /* 빈 상태 — HTML 또는 desktop 이미지 미입력 또는 비활성 */
  const willHide =
    !parsed.success ||
    !parsed.data.enabled ||
    !parsed.data.custom_html_path ||
    !parsed.data.image_path_desktop;

  if (willHide) {
    return (
      <div
        style={{
          minHeight: '40vh',
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
            Preview · Empty
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {!parsed.success
              ? '입력 검증 실패 — 필수 필드를 확인해 주세요.'
              : !parsed.data.enabled
                ? '시그니처 섹션 비활성 — 활성으로 변경하면 표시됩니다.'
                : !parsed.data.custom_html_path
                  ? '배너 HTML 파일을 업로드해 주세요.'
                  : 'Desktop 이미지를 업로드해 주세요.'}
          </div>
        </div>
      </div>
    );
  }

  return <SignatureChapterView signature={parsed.data} />;
}
