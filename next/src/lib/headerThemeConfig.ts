/* ══════════════════════════════════════════
   headerThemeConfig
   페이지별 헤더 초기 테마 매핑
   ──────────────────────────────────────────
   SSR/hydration 시점에 헤더 뒤 배경이 dark/light인지 결정한다.
   이 값이 틀리면 페이지 로드 직후 light ↔ dark 플래시가 발생한다.

   마운트 이후에는 useHeaderTheme 훅이 스크롤 위치의
   `[data-header-theme]` 섹션을 읽어 자동 갱신한다.
   ══════════════════════════════════════════ */

import type { HeaderTheme } from '@/types/navigation';

type HeaderThemeRule = {
  /** 매칭할 경로 (예: '/', '/shop') */
  path: string;
  /** true면 정확 일치, false/undefined면 접두사 일치 */
  exact?: boolean;
  /** 초기 테마 */
  theme: HeaderTheme;
};

/**
 * 페이지별 초기 헤더 테마.
 *
 * 매칭 우선순위:
 *   1) exact 일치
 *   2) 접두사 일치 중 가장 긴 path
 *   3) 기본값 (DEFAULT_INITIAL_THEME)
 *
 * 페이지 첫 화면(뷰포트 상단)의 배경을 기준으로 지정한다.
 *   - 히어로 비디오/이미지가 어두우면 'dark'
 *   - 목록/카드 배경이 밝으면 'light'
 */
const HEADER_INITIAL_THEME_RULES: HeaderThemeRule[] = [
  { path: '/', exact: true, theme: 'dark' },        // 홈: 다크 히어로 비디오
  { path: '/story', theme: 'dark' },                // 브랜드 스토리: 다크 히어로
  { path: '/gooddays', theme: 'light' },            // Good Days 갤러리: 밝은 배경 + 좋은 순간들 타이틀
  { path: '/shop', theme: 'light' },                // 쇼핑: 밝은 상품 그리드
  { path: '/menu', theme: 'light' },                // 카페 메뉴: 밝은 배경
  { path: '/mypage', theme: 'light' },              // 마이페이지: 밝은 배경
  { path: '/login', theme: 'light' },               // 로그인: 밝은 배경
  { path: '/cart', theme: 'light' },                // 장바구니: 밝은 배경
  { path: '/checkout', theme: 'light' },            // 체크아웃: 밝은 배경
  { path: '/biz-inquiry', theme: 'light' },         // 비즈니스 문의: 밝은 배경
];

const DEFAULT_INITIAL_THEME: HeaderTheme = 'dark';

/**
 * pathname에 대응하는 초기 헤더 테마를 반환한다.
 * 매칭되는 룰이 없으면 DEFAULT_INITIAL_THEME.
 */
export function getInitialHeaderTheme(pathname: string): HeaderTheme {
  /* 1) exact 일치 우선 */
  const exact = HEADER_INITIAL_THEME_RULES.find(
    (r) => r.exact && r.path === pathname,
  );
  if (exact) return exact.theme;

  /* 2) 접두사 일치 중 가장 긴 path */
  const prefixMatch = HEADER_INITIAL_THEME_RULES
    .filter((r) => !r.exact)
    .filter((r) => pathname === r.path || pathname.startsWith(r.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (prefixMatch) return prefixMatch.theme;

  /* 3) 기본값 */
  return DEFAULT_INITIAL_THEME;
}
