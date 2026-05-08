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
  /** 다음 배송일까지 남은 일수 (D-7 등 표기) */
  daysUntilNext?: number | null;
  /** 일시정지 액션 (sub 의 status 가 active 일 때) */
  onPause: () => void;
  /** 배송 건너뛰기 */
  onSkip: () => void;
  /** 변경 (편집 모드 진입) */
  onEdit: () => void;
};

export default function NextDeliveryCard({
  sub,
  daysUntilNext,
  onPause,
  onSkip,
  onEdit,
}: Props) {
  if (!sub) {
    return (
      <section className="mp-next-card mp-next-card--empty" aria-label="정기배송">
        <div className="mp-next-empty-text">
          <span className="mp-next-eyebrow">SUBSCRIPTION</span>
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
  const eyebrowText = isPaused
    ? '일시정지 중'
    : typeof daysUntilNext === 'number'
      ? `NEXT · D-${daysUntilNext}`
      : `NEXT · ${sub.nextDate}`;

  return (
    <section className="mp-next-card" aria-label="다음 정기배송">
      <div className="mp-next-info">
        <span className="mp-next-eyebrow">{eyebrowText}</span>
        <h2 className="mp-next-name">{extractKrName(sub.name)}</h2>
        <p className="mp-next-meta">
          {sub.volume} · 정기배송 {sub.cycle}
        </p>
        <div className="mp-next-actions">
          <button
            type="button"
            className="mp-next-action mp-next-action--primary"
            onClick={onPause}
            disabled={isPaused}
            data-gtr-tap
          >
            {isPaused ? '재개하기' : '일시정지'}
          </button>
          <button
            type="button"
            className="mp-next-action mp-next-action--outline"
            onClick={onSkip}
            disabled={isPaused}
            data-gtr-tap
          >
            건너뛰기
          </button>
          <button
            type="button"
            className="mp-next-action mp-next-action--text"
            onClick={onEdit}
            data-gtr-tap
          >
            변경
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
