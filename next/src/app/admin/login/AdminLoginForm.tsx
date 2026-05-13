'use client';

/* ══════════════════════════════════════════
   AdminLoginForm — Claude Design 핸드오프 (S126).
   S222 PR-2: 입력 / 체크박스 / 제출 버튼 → shadcn 정정.
   카드 wrapper / 로고 / 헤딩 / 푸터 = login 한정 레이아웃 inline 유지.
   비즈니스 로직 (supabase signIn + admin 검증) 그대로.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
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
      {/* 브랜드 워드마크 — 메인 사이트 헤더와 동일한 SVG */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 680 142"
          role="img"
          aria-label="Good Things"
          style={{
            height: 32,
            width: 'auto',
            display: 'block',
            color: 'var(--foreground)',
            fill: 'currentColor',
          }}
        >
          <polygon points="357.6493 27.2046 339.6493 27.2046 339.6493 44.0773 328.9311 44.0773 328.9311 59.1319 339.6493 59.1319 339.6493 101.2046 357.6493 101.2046 357.6493 59.1319 368.3675 59.1319 368.3675 44.0773 357.6493 44.0773 357.6493 27.2046" />
          <path d="M267.5625,47.602c-4.5569-3.3784-10.093-5.3652-16.0682-5.3652-15.5443,0-28.1454,13.407-28.1454,29.9454s12.6012,29.9455,28.1454,29.9455c5.9752,0,11.5113-1.9868,16.0682-5.3652v4.4562h18V19.1095h-18v28.4925ZM254.758,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637c6.0793,0,11.1985,4.4464,12.8045,10.5203v8.0867c-1.606,6.0739-6.7252,10.5203-12.8045,10.5203Z" />
          <rect x="441.922" y="44.0773" width="18" height="57.1273" />
          <circle cx="451.0902" cy="27.3409" r="11" />
          <path d="M578.3129,43.4318l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM565.6629,85.8955c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
          <path d="M63.8171,43.3818l.0443,4.4272c-3.1327-2.7106-8.2188-5.6545-15.5489-5.6545-11.6182,0-27.6545,6.5454-27.6545,28.3091,0,6.3818,1.3091,29.6182,26.8364,29.6182,8.801,0,13.9335-2.7527,16.8364-5.3906l.0591,5.8997s-.9205,9.3091-11.8227,9.3091c-8.3455,0-10.9637-5.5636-10.9637-5.5636h-17.0182s4.0909,21.2727,28.1455,21.2727,29.6591-20.4182,29.6591-25.0182l-.5727-57.2091h-18ZM51.1671,85.8455c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
          <path d="M505.2084,42.7682c-7.9653,0-12.7753,3.2297-15.0136,5.261v-3.952h-18v57.1273h18v-33.4c0-4.0909,2.5773-10.4728,10.5954-10.4728s9.2046,9.3273,9.2046,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
          <path d="M408.9902,42.7682c-7.7888,0-12.5494,3.0837-14.85,5.1199v-28.6835h-18v82h18v-35.2197c.6652-3.926,3.5295-8.6531,10.4318-8.6531,8.0182,0,9.2045,9.3273,9.2045,9.3273v34.5455h18v-34.5455c0-17.6727-12.6409-23.8909-22.7864-23.8909Z" />
          <path d="M654.977,72.1798c-3.3117-3.0418-8.434-4.4457-15.5883-6.2494-9.0935-2.2925-16.1961-2.7531-16.1961-6.4971,0-3.1037,4.8378-4.2306,9.1287-4.2306,9.1708,0,8.9838,5.1982,8.9838,5.1982h17.1823c0-9.2549-9.2549-18.6781-25.2406-18.6781s-27.0916,7.7405-27.0916,19.3512c0,4.3683,1.6161,8.1512,4.365,11.1059,3.3117,3.0418,8.434,4.4457,15.5883,6.2494,9.0935,2.2925,16.1961,2.7531,16.1961,6.4971,0,3.1037-4.8378,4.2306-9.1287,4.2306-9.1708,0-10.2178-5.7123-10.2178-5.7123h-17.1823c0,9.2549,10.4889,19.1922,26.4746,19.1922s27.0916-7.7405,27.0916-19.3512c0-4.3683-1.6161-8.1512-4.365-11.1059Z" />
          <path d="M120.858,42.2368c-16.8999,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM120.858,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
          <path d="M187.6216,42.2368c-16.9,0-30.6,13.407-30.6,29.9455s13.7001,29.9454,30.6,29.9454,30.6-13.407,30.6-29.9454-13.7001-29.9455-30.6-29.9455ZM187.6216,86.7459c-7.3655,0-13.3364-6.5204-13.3364-14.5637s5.9709-14.5637,13.3364-14.5637,13.3364,6.5204,13.3364,14.5637-5.9709,14.5637-13.3364,14.5637Z" />
        </svg>
      </div>

      {/* 헤딩 */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1
          style={{
            margin: 0,
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
          <Input
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
          <Input
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
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
            disabled={submitting}
            aria-label="로그인 상태 유지"
          />
          로그인 상태 유지
        </label>

        {/* 제출 */}
        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={submitting}
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
        </Button>
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

