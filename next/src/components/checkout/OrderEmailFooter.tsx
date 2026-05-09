/* ══════════════════════════════════════════
   OrderEmailFooter — /order-complete §5.4 (PR-E)
   자문 D editorial confirmation 5 zone 마지막 zone.

   설계:
   - 한 줄 center · 정중한 톤
   - 본문: kr / body-s(13) / tertiary
   - 이메일만 ink + en (mono 자체 토큰 없음)
   - 컨테이너: cream 배경 (ocp-body 상속) + 상단 헤어라인 1px secondary
   - email 미존재 시 null 반환 (회귀 안전)
   ══════════════════════════════════════════ */

'use client';

import './OrderEmailFooter.css';

type Props = {
  email?: string;
};

export default function OrderEmailFooter({ email }: Props) {
  if (!email) return null;
  return (
    <section className="oc-email">
      <p className="oc-email__line">
        주문 확인 이메일을 <span className="oc-email__addr">{email}</span>으로 보내드렸습니다.
      </p>
    </section>
  );
}
