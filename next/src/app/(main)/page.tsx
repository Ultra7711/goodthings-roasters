/* ══════════════════════════════════════════
   Home Page — P-2 placeholder
   P-3 이후 섹션별로 채워짐
   ══════════════════════════════════════════ */

export default function HomePage() {
  return (
    <section
      id="hero-blk"
      data-header-theme="dark"
      style={{
        /* 프로토타입 #hero-blk{margin-top:-96px} 이식
           → 어나운스(36px) + 헤더(60px) 뒤로 섹션이 확장되어
             sticky 헤더 blur가 상단에서도 다크 배경을 블러 처리함 */
        marginTop: '-96px',
        minHeight: '100vh',
        background: 'var(--color-background-inverse)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ color: 'var(--color-text-inverse)', fontFamily: 'var(--font-en)', opacity: 0.4, letterSpacing: '0.04em', fontSize: '13px' }}>
        pixel-port in progress
      </span>
    </section>
  );
}
