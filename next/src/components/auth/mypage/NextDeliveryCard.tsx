/* ══════════════════════════════════════════
   NextDeliveryCard — 다음 정기배송 sand 패널 (V2 §3.2 · S197 PR-2 §2.3~§2.6)
   - grid 1fr / 240px · sand bg + ink-on-sand
   - 좌: 상품명 H3 + 메타 + "정기배송 관리" 버튼 (단일 CTA)
   - 우: 1:1 패키지 사진 (max-height 240) — sub.imageUrl wire
   PR-2 사용자 결정: 일시정지/건너뛰기 직접 액션 폐기 → "정기배송 관리" 단일 진입점.
   ══════════════════════════════════════════ */

'use client';

import Image from 'next/image';
import './NextDeliveryCard.css';
import { extractKrName } from '@/lib/utils';
import type { Subscription } from '@/types/subscription';

type Props = {
  /** 활성 정기배송 첫 항목 (다음 배송일 기준) */
  sub: Subscription;
  /** 사이드바 '정기배송' view 로 전환 */
  onManage: () => void;
};

export default function NextDeliveryCard({ sub, onManage }: Props) {
  const krName = extractKrName(sub.name);
  const metaLine = `${sub.nextDate} · ${sub.cycle} 주기`;

  return (
    <section className="mp-next-card" aria-label="다음 정기배송">
      <div className="mp-next-info">
        <h2 className="mp-next-name">
          {krName}
          {sub.volume && <span className="mp-next-volume"> · {sub.volume}</span>}
        </h2>
        <p className="mp-next-meta">{metaLine}</p>
        <button
          type="button"
          className="mp-hero-cta"
          onClick={onManage}
          data-gtr-tap
        >
          정기배송 관리 →
        </button>
      </div>
      <div className="mp-next-image" aria-hidden="true">
        {sub.imageUrl ? (
          <Image
            src={sub.imageUrl}
            alt=""
            fill
            sizes="240px"
            className="mp-next-image-img"
          />
        ) : (
          <div className="mp-next-image-placeholder" />
        )}
      </div>
    </section>
  );
}
