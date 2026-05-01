'use client';

/* ══════════════════════════════════════════
   AdminLoginForm — Claude Design 핸드오프 적용.
   - 380px 카드 + 도트 패턴 backdrop + 브랜드 마크
   - 이메일 + 비밀번호 + (참고용 placeholder) 로그인 유지 + 비번 찾기 링크
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Checkbox } from '@/components/admin/ui/checkbox';

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('로그인 실패', { description: error.message });
        return;
      }

      const res = await fetch('/api/admin/me', { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        await supabase.auth.signOut();
        toast.error('관리자 권한이 없습니다.');
        return;
      }

      toast.success('로그인 완료');
      router.replace('/admin');
      router.refresh();
    } catch {
      toast.error('알 수 없는 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative w-[380px] p-9 pb-7"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* 브랜드 마크 */}
      <div className="mb-6 flex justify-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[10px] text-white"
          style={{
            background: 'var(--foreground)',
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            fontSize: 22,
          }}
        >
          G
        </div>
      </div>

      {/* 헤딩 */}
      <div className="mb-7 text-center">
        <h1
          className="gtr-serif m-0 text-[22px] font-medium"
          style={{ letterSpacing: '-0.02em' }}
        >
          어드민 로그인
        </h1>
        <div
          className="mt-1.5 text-[13px]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Good Things Roasters · 운영자 콘솔
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="admin-email" className="flex items-center gap-1 text-[12.5px] font-medium">
            이메일 <span style={{ color: 'var(--primary)' }}>*</span>
          </Label>
          <Input
            id="admin-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="h-[34px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="admin-password" className="flex items-center gap-1 text-[12.5px] font-medium">
              비밀번호 <span style={{ color: 'var(--primary)' }}>*</span>
            </Label>
            <span
              className="text-[11.5px]"
              style={{ color: 'var(--foreground-muted)' }}
            >
              비밀번호 분실 시 운영자에게 문의
            </span>
          </div>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="h-[34px]"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px]"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
            disabled={submitting}
            aria-label="로그인 상태 유지"
          />
          로그인 상태 유지
        </label>

        <Button type="submit" disabled={submitting} className="mt-1 h-[38px] w-full">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          로그인
        </Button>
      </form>

      {/* 푸터 */}
      <div
        className="mt-6 flex justify-center pt-4 text-[11.5px]"
        style={{
          borderTop: '1px solid var(--border)',
          color: 'var(--foreground-subtle)',
          letterSpacing: '0.02em',
        }}
      >
        Good Things Roasters · Admin Console
      </div>
    </div>
  );
}
