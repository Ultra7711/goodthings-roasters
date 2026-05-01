'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';

type Props = {
  email: string;
};

export default function AdminTopbar({ email }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('로그아웃 실패', { description: error.message });
      return;
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="md:hidden">
        <span className="text-sm font-semibold tracking-tight">GTR Admin</span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="size-4" />
          <span>{email}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}
