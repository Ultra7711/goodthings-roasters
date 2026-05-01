'use client';

/* ══════════════════════════════════════════
   AdminSidebar — Claude Design 핸드오프 적용.
   - warm-leaning #1A1A1A 다크 톤
   - 섹션 그룹 (운영 / 카탈로그 / 인사이트 / 설정)
   - 활성 항목 좌측 2px clay orange 인디케이터
   - 하단 사용자 카드
   ══════════════════════════════════════════ */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Repeat,
  Coffee,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  Image as ImageIcon,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandMark from './BrandMark';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: '운영',
    items: [
      { href: '/admin', label: '대시보드', icon: LayoutDashboard },
      { href: '/admin/orders', label: '주문', icon: Package },
      { href: '/admin/subscriptions', label: '정기배송', icon: Repeat },
    ],
  },
  {
    label: '카탈로그',
    items: [
      { href: '/admin/products', label: '상품', icon: Coffee },
      { href: '/admin/menu', label: '카페 메뉴', icon: UtensilsCrossed },
      { href: '/admin/users', label: '고객', icon: Users },
      { href: '/admin/gooddays', label: '굿데이즈', icon: ImageIcon },
    ],
  },
  {
    label: '인사이트',
    items: [{ href: '/admin/analytics', label: '통계', icon: BarChart3 }],
  },
  {
    label: '설정',
    items: [{ href: '/admin/settings', label: '사이트 설정', icon: Settings }],
  },
];

type Props = {
  email: string;
};

export default function AdminSidebar({ email }: Props) {
  const pathname = usePathname();

  /* 이메일 → 이니셜 변환 (Avatar fallback) */
  const initial = email.trim().charAt(0).toUpperCase() || 'A';

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col md:flex"
      style={{
        background: 'var(--sidebar-bg)',
        color: 'var(--sidebar-fg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* 브랜드 영역 */}
      <div
        className="px-4 pb-3.5 pt-4"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <BrandMark />
      </div>

      {/* 네비게이션 */}
      <nav className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-3 py-3.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div
              className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase"
              style={{
                color: 'var(--sidebar-fg-subtle)',
                letterSpacing: '0.1em',
              }}
            >
              {group.label}
            </div>
            <div className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                      active ? 'font-medium' : 'font-normal',
                    )}
                    style={{
                      color: active
                        ? 'var(--sidebar-active-fg)'
                        : 'var(--sidebar-fg)',
                      background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-sm"
                        style={{ background: 'var(--sidebar-accent)' }}
                      />
                    )}
                    <item.icon
                      className={active ? 'opacity-100' : 'opacity-75'}
                      size={18}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && (
                      <span
                        className="gtr-tnum px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        style={{
                          background: 'var(--sidebar-accent)',
                          borderRadius: 999,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 사용자 카드 */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        <div
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2"
          style={{ background: 'var(--sidebar-bg-elevated)' }}
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: '#3a352f' }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div
              className="truncate text-xs font-medium"
              style={{ color: 'var(--sidebar-fg)' }}
            >
              관리자
            </div>
            <div
              className="truncate text-[10.5px]"
              style={{ color: 'var(--sidebar-fg-muted)' }}
            >
              {email}
            </div>
          </div>
          <ChevronDown
            size={12}
            style={{ color: 'var(--sidebar-fg-muted)' }}
          />
        </div>
      </div>
    </aside>
  );
}
