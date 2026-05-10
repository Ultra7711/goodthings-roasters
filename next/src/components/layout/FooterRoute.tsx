/* ══════════════════════════════════════════
   FooterRoute — 라우트별 SiteFooter 표시 분기 (S200 PR-B.5).

   /order-complete 처럼 자체 emotional moment / footer 흐름을 가진 라우트는
   사이트 SiteFooter 를 비표시. 그 외 (main) 페이지는 일반 SiteFooter 표시.

   children pattern — server component (SiteFooter) 를 부모 (server) 에서 마운트해
   children prop 으로 전달. client → server import 금지 규칙 회피.
   ══════════════════════════════════════════ */

'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** 정확 일치 또는 하위 경로 매칭으로 footer 숨김 */
const FOOTER_HIDDEN = ['/order-complete', '/dev/order-complete', '/cart'];

type Props = { children: ReactNode };

export default function FooterRoute({ children }: Props) {
  const pathname = usePathname();
  if (!pathname) return <>{children}</>;

  // 정확 일치 / 하위 경로
  if (FOOTER_HIDDEN.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;

  // PDP: /shop/[slug] — /shop 목록은 유지, /shop/ 하위만 제거
  if (pathname.startsWith('/shop/')) return null;

  return <>{children}</>;
}
