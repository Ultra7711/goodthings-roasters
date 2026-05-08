/* ══════════════════════════════════════════
   AnnouncementBar — server component (S129 H-5)

   site_settings.notice 에서 fetch:
   - enabled = false → 렌더 자체 안 함 (height 0)
   - text / secondary / link / theme_idx → 동적 적용

   기존 className/구조 유지 (.ann · .ann-kr · .ann-secondary · .ann-en).
   theme_idx 가 default(0) 가 아니면 inline 색상 override.
   ══════════════════════════════════════════ */

import './AnnouncementBar.css';
import Link from 'next/link';
import {
  composeNoticeText,
  NOTICE_COLOR_THEMES,
} from '@/lib/siteSettings';
import { fetchSiteSettings } from '@/lib/siteSettingsServer';

export default async function AnnouncementBar() {
  const { notice, shipping } = await fetchSiteSettings();

  if (!notice.enabled) return null;

  /* auto_text=true → shipping.free_threshold 로 자동 합성, false → notice.text */
  const text = composeNoticeText(notice, shipping);
  if (!text && !notice.secondary) return null;
  const secondary = notice.secondary;
  const link = notice.link?.trim();
  const themeIdx = Math.min(
    Math.max(0, notice.theme_idx),
    NOTICE_COLOR_THEMES.length - 1,
  );
  const [bg, fg] = NOTICE_COLOR_THEMES[themeIdx];

  /* `.ann` CSS 가 background/color 를 직접 지정하므로 inline style 도 .ann 요소에 직접 적용.
     theme_idx 0 = default 톤은 .ann 의 기본 토큰 그대로 사용 (override 없음). */
  const isDefault = themeIdx === 0;
  const annStyle = isDefault
    ? undefined
    : ({ background: bg, color: fg } as const);

  const content = (
    <>
      {text && <span className="ann-kr">{text}</span>}
      {secondary && (
        <span className="ann-secondary">
          {text && <span className="ann-dot">·</span>}
          <span className="ann-en">{secondary}</span>
        </span>
      )}
    </>
  );

  return (
    <div id="site-ann-wrap">
      {link ? (
        <Link href={link} className="ann" style={annStyle}>
          {content}
        </Link>
      ) : (
        <div className="ann" style={annStyle}>{content}</div>
      )}
    </div>
  );
}
