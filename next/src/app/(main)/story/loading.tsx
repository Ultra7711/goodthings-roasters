/* ══════════════════════════════════════════
   Story Loading Shell — BUG-007 fix (S71)

   Story 라우트 진입 시 React Suspense fallback 활성 동안
   warm-white .page-loading-shell 이 노출되어 다크 hero 등장 직전
   "흰색 번쩍" 으로 체감되던 현상 제거.

   §11-8 (S71) 측정 결과:
   - .page-bg 핑크 안 보임 → page-bg 무관
   - <main> 핑크 보임 + loading-shell mounted 확정 → loading-shell 노출이 원인

   해결: story 전용 dark loading shell. (main)/loading.tsx 는
   라이트 라우트 (shop·menu·account 등) 용으로 보존 (X4 회피).
   ══════════════════════════════════════════ */

export default function StoryLoading() {
  return <div className="page-loading-shell page-loading-shell--dark" />;
}
