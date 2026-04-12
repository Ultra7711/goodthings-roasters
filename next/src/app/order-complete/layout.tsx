/* ══════════════════════════════════════════
   OrderCompleteLayout
   주문완료는 자체 미니 헤더만 사용하는 독립 레이아웃.
   ══════════════════════════════════════════ */

import type { ReactNode } from 'react';
import ToastContainer from '@/components/layout/ToastContainer';

export default function OrderCompleteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
