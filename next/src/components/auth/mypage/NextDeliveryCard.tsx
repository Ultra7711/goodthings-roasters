/* ══════════════════════════════════════════
   NextDeliveryCard — 다음 정기배송 sand 패널 (V2 §3.2 · S197 PR-1.2 stub)
   - 1fr / 1fr · gap 48 · sand bg + ink-on-sand text
   - 좌: NEXT eyebrow (D-7 또는 "21일 후") + 상품명 H3 + 메타 + 3 액션
   - 우: 5:4 패키지 사진
   - 정기배송 없을 때: empty CTA "정기배송 살펴보기"
   PR-1.3 에서 SubscriptionEditor 모달과 wire (일시정지/건너뛰기/변경)
   ══════════════════════════════════════════ */

'use client';

import Link from 'next/link';
import './NextDeliveryCard.css';
import { extractKrName } from '@/lib/utils';
import type { Subscription } from '@/types/subscription';

type Props = {
  /** 활성 정기배송 첫 항목 (다음 배송일 기준) */
  sub: Subscription | null;
  /** 일시정지 액션 (sub 의 status 가 active 일 때) */
  onPause: () => void;
  /** 배송 건너뛰기 */
  onSkip: () => void;
};

export default function NextDeliveryCard({
  sub,
  onPause,
  onSkip,
}: Props) {
  if (!sub) {
    return (
      <section className="mp-next-card mp-next-card--empty" aria-label="정기배송">
        <div className="mp-next-empty-text">
          <p className="mp-next-empty-title">아직 정기배송이 없어요.</p>
          <p className="mp-next-empty-desc">
            좋아하는 원두를 정기적으로 받아보세요.
          </p>
        </div>
        <Link href="/shop" className="mp-next-empty-cta" data-gtr-tap>
          정기배송 살펴보기 →
        </Link>
      </section>
    );
  }

  const isPaused = sub.status === 'paused';
  const nameLine = sub.volume
    ? `${extractKrName(sub.name)} · ${sub.volume}`
    : extractKrName(sub.name);
  const metaLine = `${sub.nextDate} · ${sub.cycle} 주기`;

  return (
    <section className="mp-next-card" aria-label="다음 정기배송">
      <div className="mp-next-info">
        <h2 className="mp-next-name">{nameLine}</h2>
        <p className="mp-next-meta">{metaLine}</p>
        <div className="mp-next-actions">
          <button
            type="button"
            className="mp-cancel-btn"
            onClick={onPause}
            data-gtr-tap
          >
            {isPaused ? '배송 재개하기' : '배송 일시정지'}
          </button>
          <button
            type="button"
            className="mp-cancel-btn"
            onClick={onSkip}
            disabled={isPaused}
            data-gtr-tap
          >
            건너뛰기
          </button>
        </div>
      </div>
      <div className="mp-next-image" aria-hidden="true">
        {/* PR-1.3 에서 product image 연결 */}
        <div className="mp-next-image-placeholder" />
      </div>
    </section>
  );
}
