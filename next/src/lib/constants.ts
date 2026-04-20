/* ══════════════════════════════════════════
   Site Constants
   ══════════════════════════════════════════ */

import type { NavItem, FooterColumn } from '@/types/navigation';

/* ── 메인 내비게이션 ── */
export const NAV_ITEMS: NavItem[] = [
  { key: 'story',     label: 'The Story',  href: '/story' },
  { key: 'menu',      label: 'Menu',       href: '/menu' },
  { key: 'shop',      label: 'Shop',       href: '/shop' },
  { key: 'gooddays',  label: 'Good Days',  href: '/gooddays' },
];

/* ── 푸터 컬럼 ── */
export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'The Story',
    links: [
      { label: 'The Story',  href: '/story' },
      { label: 'Location',   href: '/story#location' },
    ],
  },
  {
    title: 'Shop',
    links: [
      { label: 'Featured Beans', href: '/shop' },
      { label: 'Cafe Menu',     href: '/menu' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'Wholesale', href: '/contact/wholesale' },
    ],
  },
];

/* ── 사업자 정보 ──
   환경변수에서 주입 (전자상거래법 §13 의무 표시).
   .env.local 미설정 시 빈 문자열 — 푸터 렌더 시 시각적 누락 → 누락 즉시 인지.
   build-time 인라인되므로 NEXT_PUBLIC_ 변경 시 재빌드 필요. */
export const BUSINESS_INFO = {
  companyName: process.env.NEXT_PUBLIC_BUSINESS_COMPANY_NAME ?? '',
  ceo: process.env.NEXT_PUBLIC_BUSINESS_CEO ?? '',
  registrationNumber: process.env.NEXT_PUBLIC_BUSINESS_REG_NUMBER ?? '',
  onlineBusinessNumber: process.env.NEXT_PUBLIC_BUSINESS_ONLINE_NUMBER ?? '',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? '',
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
} as const;

/* ── 어나운스 바 ── */
export const ANNOUNCEMENT_TEXT = '30,000원 이상 구매 시 무료 배송';
export const ANNOUNCEMENT_TEXT_EN = 'Specialty Coffee For All';

/* ── SNS ── */
export const INSTAGRAM_URL = 'https://www.instagram.com/goodthings_roasters/';

/* ── 약관 버전 ──
   주문 시 orders.terms_version 컬럼에 스냅샷되는 증빙용 값.
   약관 개정 시 YYYY-MM-DD 로 갱신하여 과거 주문의 당시 약관 추적성을 확보한다. */
export const CHECKOUT_TERMS_VERSION = '2026-04-16';
