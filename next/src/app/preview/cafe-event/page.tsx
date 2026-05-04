/* ══════════════════════════════════════════
   /preview/cafe-event — 라이브 미리보기 (S151 PR-2a)

   책임:
   - admin 가드 (비admin → /admin/login).
   - URL 파라미터 → CafeEvent 조립 → CafeEventSchema safeParse.
   - EventBanner 호출 (메인 페이지 §2.5 와 동일 컴포넌트).
   - 빈 상태 (banner 미표시 조건) 시 placeholder.

   호출:
   - 어드민 CafeEventsForm iframe src 로만 사용. 외부 임베드는 frame-ancestors 'self'.

   참조:
   - app/preview/signature/page.tsx (signature 패턴)
   - components/home/EventBanner.tsx
   - lib/cafeEvents.ts CafeEventSchema
   ══════════════════════════════════════════ */

import { redirect } from 'next/navigation';
import { getAdminClaims } from '@/lib/auth/getClaims';
import { CafeEventSchema } from '@/lib/cafeEvents';
import EventBanner from '@/components/home/EventBanner';

interface PreviewCafeEventPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** 빈 문자열 → null (cafe_events 의 nullable 분기 필드 동일 변환). */
function asNullable(v: string | string[] | undefined): string | null {
  const s = asString(v);
  return s === '' ? null : s;
}

export default async function PreviewCafeEventPage({
  searchParams,
}: PreviewCafeEventPageProps) {
  const claims = await getAdminClaims();
  if (!claims) redirect('/admin/login');

  const params = await searchParams;

  /* placeholder UUID — preview 는 schema 통과만 필요, DB 저장 X */
  const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

  const parsed = CafeEventSchema.safeParse({
    id: PLACEHOLDER_UUID,
    type: asString(params.type) || 'campaign',
    enabled: asString(params.enabled) === 'true',
    eyebrow: asString(params.eyebrow),
    h4: asString(params.h4),
    meta: asString(params.meta),
    description: asString(params.description),
    image_path: asString(params.image_path),
    image_alt: asString(params.image_alt),
    start_date: asString(params.start_date),
    end_date: asString(params.end_date),
    recurring: asNullable(params.recurring),
    linked_menu_slug: asNullable(params.linked_menu_slug),
    season_label: asNullable(params.season_label),
    partner_name: asNullable(params.partner_name),
    cta_target: asNullable(params.cta_target),
    sort_order: 0,
  });

  /* 빈 상태 — 어드민이 신규 폼 첫 진입 시 (h4 비어있음) */
  const willHide =
    !parsed.success ||
    !parsed.data.enabled ||
    (!parsed.data.h4 && !parsed.data.image_path);

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
                ? '이벤트 비활성 — 활성으로 변경하면 표시됩니다.'
                : '제목과 이미지를 입력해 주세요.'}
          </div>
        </div>
      </div>
    );
  }

  return <EventBanner event={parsed.data} />;
}
