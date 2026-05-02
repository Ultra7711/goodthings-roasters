'use client';

/* ══════════════════════════════════════════
   AdminLoginForm — Claude Design 핸드오프 (S126).
   시안 login.jsx inline style 100% 이식. shadcn 의존 0.
   비즈니스 로직 (supabase signIn + admin 검증) 유지.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
      style={{
        position: 'relative',
        width: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '36px 36px 28px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      {/* 브랜드 마크 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#1A1A1A',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            fontSize: 22,
          }}
        >
          G
        </div>
      </div>

      {/* 헤딩 */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--foreground)',
          }}
        >
          어드민 로그인
        </h1>
        <div
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--foreground-muted)',
          }}
        >
          Good Things Roasters · 운영자 콘솔
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 이메일 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="admin-email"
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--foreground)',
              letterSpacing: '-0.005em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            이메일 <span style={{ color: 'var(--primary)' }}>*</span>
          </label>
          <AdminInput
            id="admin-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* 비밀번호 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label
              htmlFor="admin-password"
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: 'var(--foreground)',
                letterSpacing: '-0.005em',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              비밀번호 <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
              비밀번호 분실 시 운영자에게 문의
            </span>
          </div>
          <AdminInput
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* 로그인 유지 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            color: 'var(--foreground-muted)',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={submitting}
            aria-label="로그인 상태 유지"
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          />
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: remember ? 'none' : '1px solid var(--border-strong)',
              background: remember ? 'var(--primary)' : 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {remember && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
          로그인 상태 유지
        </label>

        {/* 제출 */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 4,
            height: 38,
            border: '1px solid var(--primary)',
            background: submitting ? 'var(--primary-hover)' : 'var(--primary)',
            color: '#fff',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.85 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {submitting && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'gtr-admin-spin 1s linear infinite' }}
            >
              <path d="M21 12a9 9 0 1 1-3.5-7.1" />
            </svg>
          )}
          로그인
        </button>
      </form>

      {/* 푸터 */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'center',
          fontSize: 11.5,
          color: 'var(--foreground-subtle)',
          letterSpacing: '0.02em',
        }}
      >
        Good Things Roasters · Admin Console
      </div>
    </div>
  );
}

/* 시안 GTRInput inline — 모듈 내 로컬 컴포넌트로 격리 */
type AdminInputProps = React.InputHTMLAttributes<HTMLInputElement>;

function AdminInput({ style, ...rest }: AdminInputProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 34,
        background: 'var(--surface)',
        border: '1px solid var(--input)',
        borderRadius: 6,
      }}
    >
      <input
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--foreground)',
          padding: 0,
          height: '100%',
          ...style,
        }}
      />
    </div>
  );
}
