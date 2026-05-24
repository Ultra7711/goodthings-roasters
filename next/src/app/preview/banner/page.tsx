/* ══════════════════════════════════════════
   /preview/banner — 통합 라이브 미리보기 (S273)

   책임:
   - admin 가드 (비admin → /admin/login).
   - URL 파라미터 → Banner 조립 → BannerSchema safeParse.
   - kind 분기: cafe_event → <EventBanner /> · signature → <SignatureChapterView />
   - 빈 상태 (HTML 또는 desktop 이미지 미입력 등) 시 placeholder.

   호출:
   - BannerEditForm iframe src 로만 사용. 외부 임베드는 frame-ancestors 'self'.

   답습: /preview/cafe-event + /preview/signature 통합 (S273 폐기)
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { BannerSchema, BANNER_KINDS, type BannerKind } from '@/lib/banners';
import EventBanner from '@/components/home/EventBanner';
import SignatureChapterView from '@/components/home/SignatureChapterView';
import '@/components/home/HomePage.css';

interface PreviewBannerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

export default async function PreviewBannerPage({ searchParams }: PreviewBannerPageProps) {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const params = await searchParams;
  const kindParam = asString(params.kind);
  const kind: BannerKind = (BANNER_KINDS as ReadonlyArray<string>).includes(kindParam)
    ? (kindParam as BannerKind)
    : 'cafe_event';

  const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';
  const defaultAspectDesktop = kind === 'cafe_event' ? '1320/480' : '1320/600';
  const defaultAspectTablet = kind === 'cafe_event' ? '1024/400' : '1024/520';
  const defaultAspectMobile = kind === 'cafe_event' ? '390/640' : '390/520';

  const parsed = BannerSchema.safeParse({
    id: DUMMY_UUID,
    kind,
    enabled: asString(params.enabled) === 'true',
    internal_label: '',
    custom_html_path: asString(params.custom_html_path),
    image_path_desktop: asString(params.image_path_desktop),
    image_path_tablet: asString(params.image_path_tablet),
    image_path_mobile: asString(params.image_path_mobile),
    image_blur_desktop: asString(params.image_blur_desktop),
    image_blur_tablet: asString(params.image_blur_tablet),
    image_blur_mobile: asString(params.image_blur_mobile),
    aspect_desktop: asString(params.aspect_desktop) || defaultAspectDesktop,
    aspect_tablet: asString(params.aspect_tablet) || defaultAspectTablet,
    aspect_mobile: asString(params.aspect_mobile) || defaultAspectMobile,
    image_alt: asString(params.image_alt),
    headline_text: asString(params.headline_text),
    subhead_text: asString(params.subhead_text),
    cta_text: asString(params.cta_text),
    cta_href: asString(params.cta_href),
    start_date: '',
    end_date: '',
    sort_order: 0,
  });

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
                ? '배너 비활성 — 활성으로 변경하면 표시됩니다.'
                : !parsed.data.custom_html_path
                  ? '배너 HTML 파일을 업로드해 주세요.'
                  : 'Desktop 이미지를 업로드해 주세요.'}
          </div>
        </div>
      </div>
    );
  }

  if (parsed.data.kind === 'signature') {
    return <SignatureChapterView signature={parsed.data} />;
  }
  return <EventBanner event={parsed.data} />;
}
