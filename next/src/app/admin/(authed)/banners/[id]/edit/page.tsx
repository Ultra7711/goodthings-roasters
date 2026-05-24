/* ══════════════════════════════════════════
   AdminBannerEditPage — 편집 (S273)
   - params.id 로 banner 단건 fetch
   - 미존재 시 list 로 redirect
   ══════════════════════════════════════════ */

import { notFound } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { parseBannerRow } from '@/lib/banners';
import BannerEditForm from '../../BannerEditForm';

type PageProps = {
  params: Promise<{ id: string }>;
};

const SELECT_COLS =
  'id, kind, enabled, internal_label, ' +
  'custom_html_path, image_path_desktop, image_path_tablet, image_path_mobile, ' +
  'image_blur_desktop, image_blur_tablet, image_blur_mobile, ' +
  'aspect_desktop, aspect_tablet, aspect_mobile, ' +
  'image_alt, headline_text, subhead_text, cta_text, cta_href, ' +
  'start_date, end_date, sort_order';

export default async function AdminBannerEditPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createRouteHandlerClient();
  const { data, error } = await supabase
    .from('banners')
    .select(SELECT_COLS)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }
  const banner = parseBannerRow(data);
  if (!banner) {
    notFound();
  }

  return (
    <BannerEditForm
      mode="edit"
      kind={banner.kind}
      banner={banner}
    />
  );
}
