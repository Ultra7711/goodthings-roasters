/* ══════════════════════════════════════════
   HeroGreeting — 마이페이지 상단 인사 (V2 §3.2)
   eyebrow `MY PAGE` + "안녕하세요, [name] 님." H1 + 메타 + 우측 로그아웃
   S197 PR-1.2 stub — PR-1.3 에서 MyPagePage 에 wire.
   ══════════════════════════════════════════ */

'use client';

import './HeroGreeting.css';

type Props = {
  name: string;
  email: string;
  onLogout: () => void;
};

export default function HeroGreeting({ name, email, onLogout }: Props) {
  return (
    <header className="mp-hero">
      <div className="mp-hero-text">
        <span className="mp-hero-eyebrow">MY PAGE</span>
        <h1 className="mp-hero-greeting">안녕하세요, {name} 님.</h1>
        <p className="mp-hero-meta">{email}</p>
      </div>
      <button
        type="button"
        className="mp-hero-logout"
        onClick={onLogout}
        data-gtr-tap
      >
        로그아웃
      </button>
    </header>
  );
}
