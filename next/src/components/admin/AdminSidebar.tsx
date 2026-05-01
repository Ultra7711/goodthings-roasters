'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  Coffee,
  UtensilsCrossed,
  Repeat,
  Image as ImageIcon,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/orders', label: '주문', icon: Package },
  { href: '/admin/users', label: '사용자', icon: Users },
  { href: '/admin/products', label: '상품', icon: Coffee },
  { href: '/admin/menu', label: '카페 메뉴', icon: UtensilsCrossed },
  { href: '/admin/subscriptions', label: '정기배송', icon: Repeat },
  { href: '/admin/gooddays', label: '굿데이즈', icon: ImageIcon },
  { href: '/admin/analytics', label: '통계', icon: BarChart3 },
  { href: '/admin/settings', label: '사이트 설정', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center border-b border-border px-5">
        <Link href="/admin" className="text-sm font-semibold tracking-tight">
          GTR Admin
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
