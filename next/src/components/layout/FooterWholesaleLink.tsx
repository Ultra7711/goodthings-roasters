/* ══════════════════════════════════════════
   FooterWholesaleLink
   푸터 Wholesale 링크의 same-page reentry 패턴 전용 클라이언트 컴포넌트.
   - /biz-inquiry 내에서 클릭 시 preventDefault + 'gtr:biz-reset' 이벤트 발송
   - 다른 라우트에서는 일반 Link 동작 (/biz-inquiry 네비게이션)
   Shop/Menu/Story 헤더 링크와 동일한 패턴
   (feedback_samepage_reentry_animation.md 참조).
   SiteFooter 는 server component 유지, 이 링크만 클라이언트 격리.
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FooterWholesaleLink() {
  const pathname = usePathname();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === '/biz-inquiry') {
      e.preventDefault();
      window.dispatchEvent(new Event('gtr:biz-reset'));
    }
  }

  return (
    <Link href="/biz-inquiry" className="footer-col-link" onClick={handleClick}>
      Wholesale
    </Link>
  );
}
