/* ══════════════════════════════════════════
   Wholesale Route — /wholesale (구 /biz-inquiry · 308 redirect 유지)
   RP-6b 재이식: 프로토타입 #biz-inquiry-page 이식.
   - BizInquiryPage 는 클라이언트 컴포넌트 (controlled form + custom dropdown)
   - 헤더 테마 light, headerThemeConfig 에 등록
   ══════════════════════════════════════════ */

import BizInquiryPage from '@/components/biz/BizInquiryPage';

export const metadata = {
  title: '비즈니스 문의',
  description: '납품·도매·협업 등 굳띵즈 로스터스 비즈니스 문의를 남겨주세요.',
  alternates: { canonical: '/wholesale' },
};

export default function BizInquiryRoute() {
  return <BizInquiryPage />;
}
