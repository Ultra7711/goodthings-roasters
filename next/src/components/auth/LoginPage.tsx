/* ══════════════════════════════════════════
   LoginPage — /login
   프로토타입 #login-page 이식 (RP-8).

   설계 결정:
   1. lp-* 클래스: 프로토타입 원본 클래스명 유지 (globals.css)
   2. 4개 폼 모드: login / register / reset / guest-lookup
   3. 소셜 로그인: 카카오·네이버·Google (Phase 2-F 연동)
   4. 체크아웃 진입 시 비회원 구매 박스 표시
   5. chp-field 시스템 재사용 (체크아웃과 동일 인풋)
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useLoginForm } from '@/hooks/useLoginForm';
import { useAtTop } from '@/hooks/useAtTop';
import { useRegisterForm } from '@/hooks/useRegisterForm';
import { useInputNav } from '@/hooks/useInputNav';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { isValidEmail, isValidOrderNumber } from '@/lib/validation';
import { safeRedirectPath } from '@/lib/utils';
import { useOrderNumberFormat } from '@/hooks/useOrderNumberFormat';
import { shakeFields } from '@/lib/shakeFields';
import { useToast } from '@/hooks/useToast';
import { TextField } from '@/components/ui/TextField';
import { supabase } from '@/lib/supabase';

/* ── 폼 모드 ── */
type LoginMode = 'login' | 'register' | 'reset' | 'guest-lookup';

/* ── OAuth 콜백 에러 메시지 맵 (?error=... 파라미터) ──
   P1-1 account_conflict_* 는 ADR-001 §3.2 병합 금지 안내 문구와 1:1 매핑.
   provider 별 안내가 다르므로 하드코딩된 메시지를 유지한다. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  /* accountMerge block — 기존 provider별 안내 (ADR §3.2) */
  account_conflict_email:
    '이 이메일은 이미 가입되어 있습니다. 이메일·비밀번호로 로그인해 주세요.',
  account_conflict_google:
    '이 이메일은 이미 Google 계정으로 가입되어 있습니다. Google로 로그인해 주세요.',
  account_conflict_kakao:
    '이 이메일은 이미 카카오 계정으로 가입되어 있습니다. 카카오로 로그인해 주세요.',
  account_conflict_naver:
    '이 이메일은 이미 네이버 계정으로 가입되어 있습니다. 네이버로 로그인해 주세요.',
  account_conflict_unknown:
    '이메일 중복으로 로그인할 수 없습니다. 기존 가입 방법으로 로그인해 주세요.',
  /* 공통 OAuth 에러 */
  auth_no_code: '로그인 정보가 누락되었습니다. 다시 시도해 주세요.',
  auth_exchange_failed: '로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
  /* Naver */
  naver_csrf_invalid: '보안 검증 실패로 로그인을 취소했습니다. 다시 시도해 주세요.',
  naver_no_code: '네이버 로그인 정보가 누락되었습니다.',
  naver_token_request_failed: '네이버 로그인 요청 중 오류가 발생했습니다.',
  naver_token_missing: '네이버 로그인 토큰을 받지 못했습니다.',
  naver_profile_failed: '네이버 프로필 조회에 실패했습니다.',
  naver_profile_missing: '네이버 프로필 정보를 받지 못했습니다.',
  naver_signin_failed: '네이버 로그인 처리 중 오류가 발생했습니다.',
  /* Kakao */
  kakao_csrf_invalid: '보안 검증 실패로 로그인을 취소했습니다. 다시 시도해 주세요.',
  kakao_no_code: '카카오 로그인 정보가 누락되었습니다.',
  kakao_token_request_failed: '카카오 로그인 요청 중 오류가 발생했습니다.',
  kakao_token_missing: '카카오 로그인 토큰을 받지 못했습니다.',
  kakao_profile_failed: '카카오 프로필 조회에 실패했습니다.',
  kakao_profile_missing: '카카오 프로필 정보를 받지 못했습니다.',
  kakao_signin_failed: '카카오 로그인 처리 중 오류가 발생했습니다.',
};

/* ── 소셜 로그인 SVG ── */
function KakaoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
      <path d="M13,0c-7.18,0-13,5.01-13,11.19,0,4.02,2.47,7.55,6.17,9.52-.27,1.1-.98,4-1.13,4.62-.18.77.26.76.54.55.22-.16,3.56-2.63,5-3.7.78.13,1.59.19,2.41.19,7.18,0,13-5.01,13-11.19S20.18,0,13,0" fill="#000000" />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 22 20" fill="none">
      <polygon points="22,0 22,20 14.6,20 7.3,9.9 7.3,20 0,20 0,0 7.3,0 14.6,10.4 14.6,0 22,0" fill="#FAFAF8" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h13.2c-.6 3-2.3 5.6-4.9 7.3v6h7.9c4.6-4.3 7.3-10.6 7.3-17.5z" fill="#4285F4" />
      <path d="M24 48c6.6 0 12.2-2.2 16.2-6l-7.9-6c-2.2 1.5-5 2.3-8.3 2.3-6.4 0-11.8-4.3-13.7-10.1H2.1v6.2C6.1 42.9 14.5 48 24 48z" fill="#34A853" />
      <path d="M10.3 28.2A14.6 14.6 0 019.5 24c0-1.5.3-2.9.8-4.2V13.6H2.1A24 24 0 000 24c0 3.9.9 7.5 2.1 10.4l8.2-6.2z" fill="#FBBC05" />
      <path d="M24 9.6c3.6 0 6.8 1.2 9.3 3.6l7-7C36.2 2.2 30.6 0 24 0 14.5 0 6.1 5.1 2.1 13.6l8.2 6.2C12.2 13.9 17.6 9.6 24 9.6z" fill="#EA4335" />
    </svg>
  );
}

/* ══════════════════════════════════════════ */
export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { show: toast } = useToast();
  const atTop = useAtTop();

  /** 체크아웃에서 진입한 경우 */
  const fromCheckout = params.get('from') === 'checkout';

  /** 로그인 후 돌아갈 경로 (?redirect=/path, 기본 /) — open redirect 방어 검증 */
  const redirectTo = safeRedirectPath(params.get('redirect'), '/');

  const [mode, setMode] = useState<LoginMode>('login');

  /* ── 폼 refs + Enter 네비게이션 ── */
  const loginRef = useRef<HTMLFormElement>(null);
  const registerRef = useRef<HTMLFormElement>(null);
  const resetRef = useRef<HTMLFormElement>(null);
  const guestRef = useRef<HTMLFormElement>(null);
  const loginNav = useInputNav(loginRef);
  const registerNav = useInputNav(registerRef);
  const resetNav = useInputNav(resetRef);
  const guestNav = useInputNav(guestRef);

  /* ── 소셜 로그인 ── */
  const [socialLoading, setSocialLoading] = useState<'kakao' | 'google' | 'naver' | null>(null);

  const handleGoogleLogin = useCallback(async () => {
    setSocialLoading('google');
    try {
      const nextPath = fromCheckout ? '/checkout' : redirectTo;
      const callbackUrl = `${window.location.origin}/auth/callback${nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl },
      });
      if (error) toast('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } catch {
      toast('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      setSocialLoading(null);
    }
  }, [fromCheckout, redirectTo, toast]);

  const handleKakaoLogin = useCallback(() => {
    setSocialLoading('kakao');
    window.location.href = '/api/auth/kakao';
  }, []);

  const handleNaverLogin = useCallback(() => {
    setSocialLoading('naver');
    window.location.href = '/api/auth/naver';
  }, []);

  /* ── 폼 훅 ── */
  const loginForm = useLoginForm({ fromCheckout, redirectTo });
  const registerForm = useRegisterForm({ redirectTo });

  /* ── 비밀번호 재설정 (간이) ── */
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');

  /* ── 비회원 주문 조회 (간이) ── */
  const [guestEmail, setGuestEmail] = useState('');
  const [guestOrderNum, setGuestOrderNum] = useState('');
  const [guestErrors, setGuestErrors] = useState<{ email?: string; orderNum?: string }>({});

  /* ── 주문번호 자동 포맷 ── */
  const orderNumFormat = useOrderNumberFormat(
    useCallback((v: string) => {
      setGuestOrderNum(v);
      setGuestErrors((p) => { if (!p.orderNum) return p; const n = { ...p }; delete n.orderNum; return n; });
    }, []),
  );

  /* ── 검증 실패 시 shake 트리거 ── */
  useEffect(() => {
    if (Object.keys(loginForm.errors).length > 0) shakeFields(loginRef.current);
  }, [loginForm.errors]);
  useEffect(() => {
    if (Object.keys(registerForm.errors).length > 0) shakeFields(registerRef.current);
  }, [registerForm.errors]);
  useEffect(() => {
    if (resetError) shakeFields(resetRef.current);
  }, [resetError]);
  useEffect(() => {
    if (Object.keys(guestErrors).length > 0) shakeFields(guestRef.current);
  }, [guestErrors]);

  /* ── 이미 로그인 상태이면 리다이렉트 ── */
  const { isLoggedIn } = useSupabaseSession();
  useEffect(() => {
    if (isLoggedIn) {
      router.replace(fromCheckout ? '/checkout' : redirectTo);
    }
  }, [isLoggedIn, router, fromCheckout, redirectTo]);

  /* ── OAuth 콜백 에러 표시 (?error=...) ──
     P1-1 account_conflict_* 포함 모든 OAuth 서버 에러를 toast로 안내.
     처리 후 URL에서 파라미터 제거해 새로고침 시 재표시 방지. */
  const errorParam = params.get('error');
  const handledErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!errorParam || handledErrorRef.current === errorParam) return;
    handledErrorRef.current = errorParam;
    const msg =
      OAUTH_ERROR_MESSAGES[errorParam] ??
      '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    toast(msg);
    /* URL 정리 — error 파라미터만 제거, 다른 쿼리(from 등)는 유지 */
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    router.replace(url.pathname + (url.search || ''));
  }, [errorParam, toast, router]);

  /* ── 모드 전환 시 에러 초기화 ── */
  const switchMode = useCallback((next: LoginMode) => {
    setMode(next);
    setResetEmail('');
    setResetError('');
    setGuestEmail('');
    setGuestOrderNum('');
    setGuestErrors({});
  }, []);

  /* ── 모드별 헤더 텍스트 ── */
  const modeConfig = useMemo(() => {
    switch (mode) {
      case 'login':
        return {
          title: '로그인',
          switchTxt: '아직 회원이 아니신가요?',
          switchLabel: '회원가입',
          switchTarget: 'register' as LoginMode,
          showCancel: false,
          showSocial: true,
          showGuestOrder: true,
        };
      case 'register':
        return {
          title: '회원가입',
          switchTxt: '이미 회원이신가요?',
          switchLabel: '로그인',
          switchTarget: 'login' as LoginMode,
          showCancel: false,
          showSocial: true,
          showGuestOrder: false,
        };
      case 'reset':
        return {
          title: '비밀번호 재설정',
          switchTxt: '가입하신 이메일 주소로 재설정 링크를 보내드립니다.',
          switchLabel: '',
          switchTarget: 'login' as LoginMode,
          showCancel: true,
          showSocial: false,
          showGuestOrder: false,
        };
      case 'guest-lookup':
        return {
          title: '비회원 주문 조회',
          switchTxt: '주문 시 입력한 정보로 주문 내역을 확인합니다.',
          switchLabel: '',
          switchTarget: 'login' as LoginMode,
          showCancel: true,
          showSocial: false,
          showGuestOrder: false,
        };
    }
  }, [mode]);

  /* ── 비밀번호 재설정 submit ── */
  const handleResetSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = resetEmail.trim();
      if (!trimmed) {
        setResetError('이메일을 입력해 주세요.');
        return;
      }
      if (!isValidEmail(trimmed)) {
        setResetError('올바른 이메일 형식을 입력해 주세요.');
        return;
      }
      setResetError('');
      toast('비밀번호 재설정 링크를 이메일로 발송했습니다.');
      switchMode('login');
    },
    [resetEmail, toast, switchMode],
  );

  /* ── 비회원 주문 조회 submit ── */
  const handleGuestLookupSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const errs: { email?: string; orderNum?: string } = {};
      const emailTrimmed = guestEmail.trim();
      if (!emailTrimmed) {
        errs.email = '이메일을 입력해 주세요.';
      } else if (!isValidEmail(emailTrimmed)) {
        errs.email = '올바른 이메일 형식을 입력해 주세요.';
      }
      const orderTrimmed = guestOrderNum.trim();
      if (!orderTrimmed || orderTrimmed === 'GT-') {
        errs.orderNum = '주문번호를 입력해 주세요.';
      } else if (!isValidOrderNumber(orderTrimmed)) {
        errs.orderNum = '올바른 주문번호 형식을 입력해 주세요.';
      }
      if (Object.keys(errs).length > 0) {
        setGuestErrors(errs);
        return;
      }
      setGuestErrors({});
      toast('비회원 주문 조회 기능은 준비 중입니다.');
    },
    [guestEmail, guestOrderNum, toast],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {/* ── 미니 헤더 ── */}
      <div
        className={`chp-hdr-wrap${atTop ? ' hdr-at-top' : ''}`}
        style={{
          backdropFilter: atTop ? 'none' : 'blur(16px)',
          WebkitBackdropFilter: atTop ? 'none' : 'blur(16px)',
        }}
      >
        <div className="chp-hdr-inner">
          <Link href="/">
            <Image src="/images/icons/logo.svg" alt="GOOD THINGS" width={140} height={28} className="chp-logo-img" />
          </Link>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="lp-body">
        {/* 타이틀 영역 */}
        <div className="lp-left">
          <div className="lp-title-row">
            <div className="lp-page-title">{modeConfig.title}</div>
          </div>
          <div className="lp-switch-wrap">
            {modeConfig.switchTxt && (
              <span className="lp-switch-txt">{modeConfig.switchTxt}</span>
            )}
            {modeConfig.switchLabel && (
              <span
                className="lp-switch-link"
                role="button"
                tabIndex={0}
                onClick={() => switchMode(modeConfig.switchTarget)}
                onKeyDown={(e) => e.key === 'Enter' && switchMode(modeConfig.switchTarget)}
              >
                {modeConfig.switchLabel}
              </span>
            )}
            {modeConfig.showCancel && (
              <span
                className="lp-switch-link"
                role="button"
                tabIndex={0}
                onClick={() => switchMode('login')}
                onKeyDown={(e) => e.key === 'Enter' && switchMode('login')}
              >
                취소하기
              </span>
            )}
          </div>
        </div>

        {/* 비회원 구매 박스 (체크아웃 진입 시) */}
        {fromCheckout && mode === 'login' && (
          <div className="lp-guest-buy-box">
            <p className="lp-guest-buy-desc">
              비회원도 상품구매가 가능하나<br />회원혜택에서 제외됩니다.
            </p>
            <button
              className="lp-guest-buy-btn"
              type="button"
              onClick={() => router.push('/checkout')}
            >
              비회원 주문
            </button>
          </div>
        )}

        {/* 폼 영역 */}
        <div className="lp-right">
          {/* ── 로그인 폼 ── */}
          {mode === 'login' && (
            <form ref={loginRef} onSubmit={loginForm.handleSubmit} noValidate>
              <TextField
                type="email"
                label="이메일 주소"
                autoComplete="email"
                value={loginForm.email}
                onChange={loginForm.setEmail}
                onBlur={loginForm.blurEmail}
                onKeyDown={loginNav}
                error={loginForm.errors.email}
                helper="이메일 주소를 입력하세요."
              />
              <TextField
                type="password"
                label="비밀번호"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={loginForm.setPassword}
                onKeyDown={loginNav}
                showPasswordToggle
                error={loginForm.errors.password}
                helper="비밀번호를 입력하세요."
              />
              {loginForm.errors.submit && (
                <div className="lp-submit-error">{loginForm.errors.submit}</div>
              )}
              <div className="lp-forgot">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => switchMode('reset')}
                  onKeyDown={(e) => e.key === 'Enter' && switchMode('reset')}
                >
                  비밀번호를 잊으셨나요?
                </span>
              </div>
              <button className="lp-submit-btn" type="submit" disabled={loginForm.isLoading}>
                {loginForm.isLoading ? '로그인 중…' : '로그인'}
              </button>
            </form>
          )}

          {/* ── 회원가입 폼 ── */}
          {mode === 'register' && (
            <form ref={registerRef} onSubmit={registerForm.handleSubmit} noValidate>
              <TextField
                label="이름"
                autoComplete="name"
                value={registerForm.name}
                onChange={registerForm.setName}
                onKeyDown={registerNav}
                error={registerForm.errors.name}
                helper="이름을 입력하세요."
              />
              <TextField
                type="email"
                label="이메일 주소"
                autoComplete="email"
                value={registerForm.email}
                onChange={registerForm.setEmail}
                onBlur={registerForm.blurEmail}
                onKeyDown={registerNav}
                error={registerForm.errors.email}
                helper="이메일 주소를 입력하세요."
              />
              <TextField
                type="password"
                label="비밀번호"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={registerForm.setPassword}
                onBlur={registerForm.blurPassword}
                onKeyDown={registerNav}
                showPasswordToggle
                error={registerForm.errors.password}
                helper="영문 대소문자/숫자/특수문자 중 2가지 이상 조합, 6~16자"
              />
              <TextField
                type="password"
                label="비밀번호 확인"
                autoComplete="off"
                disabled={registerForm.pw2Disabled}
                value={registerForm.password2}
                onChange={registerForm.setPassword2}
                onBlur={registerForm.blurPassword2}
                onKeyDown={registerNav}
                showPasswordToggle
                error={registerForm.errors.password2}
                helper="비밀번호를 한 번 더 입력하세요."
                wrapperClass={`pw2-field${registerForm.password ? ' pw2-visible' : ''}`}
              />
              {registerForm.errors.submit && (
                <div className="lp-submit-error">{registerForm.errors.submit}</div>
              )}
              {registerForm.notice && (
                <div className="lp-submit-notice">{registerForm.notice}</div>
              )}
              <button className="lp-submit-btn" type="submit" disabled={registerForm.isLoading}>
                {registerForm.isLoading ? '처리 중…' : '계정 만들기'}
              </button>
            </form>
          )}

          {/* ── 비밀번호 재설정 폼 ── */}
          {mode === 'reset' && (
            <form ref={resetRef} onSubmit={handleResetSubmit} noValidate>
              <TextField
                type="email"
                label="이메일 주소"
                autoComplete="email"
                value={resetEmail}
                onChange={(v) => { setResetEmail(v); setResetError(''); }}
                onBlur={() => { const t = resetEmail.trim(); if (t && !isValidEmail(t)) setResetError('올바른 이메일 형식을 입력해 주세요.'); }}
                onKeyDown={resetNav}
                onClear={() => { setResetEmail(''); setResetError(''); }}
                error={resetError}
                helper="가입 시 등록한 이메일 주소를 입력하세요."
              />
              <button className="lp-submit-btn" type="submit">전송</button>
            </form>
          )}

          {/* ── 비회원 주문 조회 폼 ── */}
          {mode === 'guest-lookup' && (
            <form ref={guestRef} onSubmit={handleGuestLookupSubmit} noValidate>
              <TextField
                type="email"
                label="이메일 주소"
                autoComplete="email"
                value={guestEmail}
                onChange={(v) => { setGuestEmail(v); setGuestErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                onBlur={() => { const t = guestEmail.trim(); if (t && !isValidEmail(t)) setGuestErrors((p) => ({ ...p, email: '올바른 이메일 형식을 입력해 주세요.' })); }}
                onKeyDown={guestNav}
                onClear={() => { setGuestEmail(''); setGuestErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                error={guestErrors.email}
                helper="주문 시 입력한 이메일 주소를 입력하세요."
              />
              <TextField
                label="주문번호"
                autoComplete="off"
                value={guestOrderNum}
                onChange={orderNumFormat.handleChangeValue}
                onFocus={orderNumFormat.handleFocus}
                onPaste={orderNumFormat.handlePaste}
                onBlur={() => { const t = guestOrderNum.trim(); if (t === 'GT-') { setGuestOrderNum(''); return; } if (t && !isValidOrderNumber(t)) setGuestErrors((p) => ({ ...p, orderNum: '올바른 주문번호 형식을 입력해 주세요.' })); }}
                onKeyDown={guestNav}
                onClear={() => { setGuestOrderNum(''); setGuestErrors((p) => { const n = { ...p }; delete n.orderNum; return n; }); }}
                hideClear={guestOrderNum === 'GT-'}
                error={guestErrors.orderNum}
                helper="GT- 뒤에 숫자를 입력하세요. 예: GT-20260413-00001"
              />
              <button className="lp-submit-btn" type="submit">주문 조회하기</button>
            </form>
          )}

          {/* ── 간편 로그인 구분선 ── */}
          {modeConfig.showSocial && (
            <>
              <div className="lp-divider-wrap">
                <div className="lp-divider-line" />
                <span className="lp-divider-txt">간편 로그인</span>
                <div className="lp-divider-line" />
              </div>

              {/* 소셜 로그인 */}
              <div className="lp-social">
                <button
                  className="lp-social-btn lp-social-btn--kakao"
                  type="button"
                  disabled={socialLoading !== null}
                  onClick={handleKakaoLogin}
                >
                  <span className="lp-social-icon"><KakaoIcon /></span>
                  <span className="lp-social-label">
                    {socialLoading === 'kakao' ? '연결 중…' : '카카오로 계속하기'}
                  </span>
                </button>
                <button
                  className="lp-social-btn lp-social-btn--naver"
                  type="button"
                  disabled={socialLoading !== null}
                  onClick={handleNaverLogin}
                >
                  <span className="lp-social-icon"><NaverIcon /></span>
                  <span className="lp-social-label">
                    {socialLoading === 'naver' ? '연결 중…' : '네이버로 계속하기'}
                  </span>
                </button>
                <button
                  className="lp-social-btn lp-social-btn--google"
                  type="button"
                  disabled={socialLoading !== null}
                  onClick={() => void handleGoogleLogin()}
                >
                  <span className="lp-social-icon"><GoogleIcon /></span>
                  <span className="lp-social-label">
                    {socialLoading === 'google' ? '연결 중…' : 'Google로 계속하기'}
                  </span>
                </button>
              </div>
            </>
          )}

          {/* 비회원 주문 조회 링크 */}
          {modeConfig.showGuestOrder && (
            <div className="lp-guest-order-wrap">
              <button
                className="lp-guest-order-btn"
                type="button"
                onClick={() => switchMode('guest-lookup')}
              >
                비회원 주문 조회하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
