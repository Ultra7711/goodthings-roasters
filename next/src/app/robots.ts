/* ══════════════════════════════════════════
   robots.ts — 크롤러 규칙 + sitemap 위치 (SEO 1차)

   - 공개 페이지 전체 허용
   - 비공개/기능 페이지 disallow (개인정보·결제·중복 색인 방지)
   - sitemap 위치 안내
   ══════════════════════════════════════════ */

import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',          // 어드민 콘솔
        '/api',            // API 라우트
        '/mypage',         // 회원 전용
        '/cart',           // 장바구니
        '/checkout',       // 결제
        '/order-complete', // 주문 완료
        '/billing',        // 빌링
        '/login',          // 로그인
        '/unsubscribe',    // 구독 해지
        '/search',         // 검색 결과 (?q= 파라미터 무한 조합 — 크롤 예산 절약)
        '/dev',            // 개발 전용
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
