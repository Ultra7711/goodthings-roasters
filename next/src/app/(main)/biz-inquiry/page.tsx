/* ══════════════════════════════════════════
   Biz Inquiry Route — /biz-inquiry
   RP-6b 재이식: 프로토타입 #biz-inquiry-page 이식.
   - BizInquiryPage 는 클라이언트 컴포넌트 (controlled form + custom dropdown)
   - 헤더 테마 light, headerThemeConfig 에 등록
   ══════════════════════════════════════════ */

import BizInquiryPage from '@/components/biz/BizInquiryPage';

export const metadata = { title: '비즈니스 문의 — good things' };

export default function BizInquiryRoute() {
  return <BizInquiryPage />;
}
