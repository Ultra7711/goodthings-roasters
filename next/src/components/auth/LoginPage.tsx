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
import { useRegisterForm } from '@/hooks/useRegisterForm';
import { useInputNav } from '@/hooks/useInputNav';
import { useAuthStore } from '@/lib/store';
import { isValidEmail } from '@/lib/validation';
import { shakeFields } from '@/lib/shakeFields';
import { useToast } from '@/hooks/useToast';
import { ClearIcon, EyeOpenIcon, EyeClosedIcon } from '@/components/ui/InputIcons';

/* ── 폼 모드 ── */
type LoginMode = 'login' | 'register' | 'reset' | 'guest-lookup';

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

  /** 체크아웃에서 진입한 경우 */
  const fromCheckout = params.get('from') === 'checkout';

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

  /* ── 폼 훅 ── */
  const loginForm = useLoginForm({ fromCheckout });
  const registerForm = useRegisterForm();

  /* ── 비밀번호 표시/숨기기 ── */
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegPw2, setShowRegPw2] = useState(false);

  /* ── 비밀번호 재설정 (간이) ── */
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');

  /* ── 비회원 주문 조회 (간이) ── */
  const [guestEmail, setGuestEmail] = useState('');
  const [guestOrderNum, setGuestOrderNum] = useState('');
  const [guestErrors, setGuestErrors] = useState<{ email?: string; orderNum?: string }>({});

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
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  useEffect(() => {
    if (isLoggedIn) {
      router.replace(fromCheckout ? '/checkout' : '/mypage');
    }
  }, [isLoggedIn, router, fromCheckout]);

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
      if (!guestOrderNum.trim()) {
        errs.orderNum = '주문번호를 입력해 주세요.';
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
      <div className="chp-hdr-wrap" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
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
              <div className={`chp-field${loginForm.errors.email ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={loginForm.email}
                  onChange={(e) => loginForm.setEmail(e.target.value)}
                  onBlur={loginForm.blurEmail}
                  onKeyDown={loginNav}
                />
                <label className="chp-floating-label">이메일 주소</label>
                {loginForm.email && (
                  <span className="chp-input-action visible" onClick={() => loginForm.setEmail('')}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {loginForm.errors.email || '이메일 주소를 입력하세요.'}
                </div>
              </div>
              <div className={`chp-field${loginForm.errors.password ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type={showLoginPw ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => loginForm.setPassword(e.target.value)}
                  onKeyDown={loginNav}
                />
                <label className="chp-floating-label">비밀번호</label>
                {loginForm.password && (
                  <span className="chp-input-actions">
                    <span className="chp-input-action visible" onClick={() => setShowLoginPw((v) => !v)} title={showLoginPw ? '비밀번호 숨기기' : '비밀번호 보기'}>{showLoginPw ? <EyeOpenIcon /> : <EyeClosedIcon />}</span>
                    <span className="chp-input-action visible" onClick={() => loginForm.setPassword('')} title="지우기"><ClearIcon /></span>
                  </span>
                )}
                <div className="chp-helper">
                  {loginForm.errors.password || '비밀번호를 입력하세요.'}
                </div>
              </div>
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
              <button
                className="lp-demo-fill-btn"
                type="button"
                onClick={loginForm.loginAsDemo}
                disabled={loginForm.isLoading}
              >
                테스트 계정으로 로그인
              </button>
            </form>
          )}

          {/* ── 회원가입 폼 ── */}
          {mode === 'register' && (
            <form ref={registerRef} onSubmit={registerForm.handleSubmit} noValidate>
              <div className={`chp-field${registerForm.errors.name ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="text"
                  placeholder=" "
                  autoComplete="name"
                  value={registerForm.name}
                  onChange={(e) => registerForm.setName(e.target.value)}
                  onKeyDown={registerNav}
                />
                <label className="chp-floating-label">이름</label>
                {registerForm.name && (
                  <span className="chp-input-action visible" onClick={() => registerForm.setName('')}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {registerForm.errors.name || '이름을 입력하세요.'}
                </div>
              </div>
              <div className={`chp-field${registerForm.errors.email ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(e) => registerForm.setEmail(e.target.value)}
                  onBlur={registerForm.blurEmail}
                  onKeyDown={registerNav}
                />
                <label className="chp-floating-label">이메일 주소</label>
                {registerForm.email && (
                  <span className="chp-input-action visible" onClick={() => registerForm.setEmail('')}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {registerForm.errors.email || '이메일 주소를 입력하세요.'}
                </div>
              </div>
              <div className={`chp-field${registerForm.errors.password ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type={showRegPw ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="new-password"
                  value={registerForm.password}
                  onChange={(e) => registerForm.setPassword(e.target.value)}
                  onBlur={registerForm.blurPassword}
                  onKeyDown={registerNav}
                />
                <label className="chp-floating-label">비밀번호</label>
                {registerForm.password && (
                  <span className="chp-input-actions">
                    <span className="chp-input-action visible" onClick={() => setShowRegPw((v) => !v)} title={showRegPw ? '비밀번호 숨기기' : '비밀번호 보기'}>{showRegPw ? <EyeOpenIcon /> : <EyeClosedIcon />}</span>
                    <span className="chp-input-action visible" onClick={() => registerForm.setPassword('')} title="지우기"><ClearIcon /></span>
                  </span>
                )}
                <div className="chp-helper">
                  {registerForm.errors.password || '영문 대소문자/숫자/특수문자 중 2가지 이상 조합, 6~16자'}
                </div>
              </div>
              <div className={`chp-field pw2-field${registerForm.password ? ' pw2-visible' : ''}${registerForm.errors.password2 ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type={showRegPw2 ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="new-password"
                  disabled={registerForm.pw2Disabled}
                  value={registerForm.password2}
                  onChange={(e) => registerForm.setPassword2(e.target.value)}
                  onBlur={registerForm.blurPassword2}
                  onKeyDown={registerNav}
                />
                <label className="chp-floating-label">비밀번호 확인</label>
                {registerForm.password2 && (
                  <span className="chp-input-actions">
                    <span className="chp-input-action visible" onClick={() => setShowRegPw2((v) => !v)} title={showRegPw2 ? '비밀번호 숨기기' : '비밀번호 보기'}>{showRegPw2 ? <EyeOpenIcon /> : <EyeClosedIcon />}</span>
                    <span className="chp-input-action visible" onClick={() => registerForm.setPassword2('')} title="지우기"><ClearIcon /></span>
                  </span>
                )}
                <div className="chp-helper">
                  {registerForm.errors.password2 || '비밀번호를 한 번 더 입력하세요.'}
                </div>
              </div>
              {registerForm.errors.submit && (
                <div className="lp-submit-error">{registerForm.errors.submit}</div>
              )}
              <button className="lp-submit-btn" type="submit" disabled={registerForm.isLoading}>
                {registerForm.isLoading ? '처리 중…' : '계정 만들기'}
              </button>
            </form>
          )}

          {/* ── 비밀번호 재설정 폼 ── */}
          {mode === 'reset' && (
            <form ref={resetRef} onSubmit={handleResetSubmit} noValidate>
              <div className={`chp-field${resetError ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => { setResetEmail(e.target.value); setResetError(''); }}
                  onKeyDown={resetNav}
                />
                <label className="chp-floating-label">이메일 주소</label>
                {resetEmail && (
                  <span className="chp-input-action visible" onClick={() => { setResetEmail(''); setResetError(''); }}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {resetError || '가입 시 등록한 이메일 주소를 입력하세요.'}
                </div>
              </div>
              <button className="lp-submit-btn" type="submit">전송</button>
            </form>
          )}

          {/* ── 비회원 주문 조회 폼 ── */}
          {mode === 'guest-lookup' && (
            <form ref={guestRef} onSubmit={handleGuestLookupSubmit} noValidate>
              <div className={`chp-field${guestErrors.email ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setGuestErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                  onKeyDown={guestNav}
                />
                <label className="chp-floating-label">이메일 주소</label>
                {guestEmail && (
                  <span className="chp-input-action visible" onClick={() => { setGuestEmail(''); setGuestErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {guestErrors.email || '주문 시 입력한 이메일 주소를 입력하세요.'}
                </div>
              </div>
              <div className={`chp-field${guestErrors.orderNum ? ' input-warn' : ''}`}>
                <input
                  className="chp-input"
                  type="text"
                  placeholder=" "
                  autoComplete="off"
                  value={guestOrderNum}
                  onChange={(e) => { setGuestOrderNum(e.target.value); setGuestErrors((p) => { const n = { ...p }; delete n.orderNum; return n; }); }}
                  onKeyDown={guestNav}
                />
                <label className="chp-floating-label">주문번호</label>
                {guestOrderNum && (
                  <span className="chp-input-action visible" onClick={() => { setGuestOrderNum(''); setGuestErrors((p) => { const n = { ...p }; delete n.orderNum; return n; }); }}><ClearIcon /></span>
                )}
                <div className="chp-helper">
                  {guestErrors.orderNum || '예: GT-20260413-00001'}
                </div>
              </div>
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
                  onClick={() => toast('카카오 로그인은 준비 중입니다.')}
                >
                  <span className="lp-social-icon"><KakaoIcon /></span>
                  <span className="lp-social-label">카카오로 계속하기</span>
                </button>
                <button
                  className="lp-social-btn lp-social-btn--naver"
                  type="button"
                  onClick={() => toast('네이버 로그인은 준비 중입니다.')}
                >
                  <span className="lp-social-icon"><NaverIcon /></span>
                  <span className="lp-social-label">네이버로 계속하기</span>
                </button>
                <button
                  className="lp-social-btn lp-social-btn--google"
                  type="button"
                  onClick={() => toast('Google 로그인은 준비 중입니다.')}
                >
                  <span className="lp-social-icon"><GoogleIcon /></span>
                  <span className="lp-social-label">Google로 계속하기</span>
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
