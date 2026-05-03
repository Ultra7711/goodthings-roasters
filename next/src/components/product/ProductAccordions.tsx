/* ══════════════════════════════════════════
   ProductAccordions — RP-4d
   ──────────────────────────────────────────
   - 배송 안내 / 교환·반품 안내 (모든 상품)
   - 제품 안내 (Drip Bag 전용)

   공통 Accordion 컴포넌트 (V2 §6.3) controlled 모드로 멀티 오픈 관리.
   상품 변경 시 모두 닫힌 초기 상태로 리셋.
   ══════════════════════════════════════════ */

'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider';
import Accordion from '@/components/common/Accordion';
import SpecTable from './SpecTable';

const DRIP_BAG_SPEC_ROWS = [
  { label: '제품명', value: '굳띵즈 드립백' },
  { label: '내용량', value: '12g × 10개' },
  { label: '식품유형', value: '커피' },
  { label: '소비기한', value: '별도표기일까지' },
  { label: '원재료 및 함량', value: '커피 100%', full: true as const },
  {
    label: '제조원',
    value: '(주)케이코닉 | 경기도 하남시 하남대로 990 B105~B107',
    full: true as const,
  },
  {
    label: '판매원',
    value: '(주)브이티이코프 | 경북 구미시 인동21길 22-11 1층',
    full: true as const,
  },
  {
    label: '포장재질',
    value: '여과지:폴리프로필렌 / 컵걸이:폴리에틸렌코팅종이 / 내포장:폴리에틸렌(내면)',
    full: true as const,
  },
  { label: '반품 및 교환', value: '구입처 054-451-4568' },
  { label: '보관방법', value: '서늘한 곳에 밀폐보관' },
  { label: '포장방법', value: '질소충전' },
  { label: '품목보고번호', value: '20170120209-470' },
] as const;

const DRIP_BAG_SPEC_FOOTER = {
  notices: [
    '부정 불량식품 신고는 국번없이 1399',
    '본 제품은 공정거래위원회 고시 소비자 분쟁해결 기준에 의거, 교환 또는 보상 받을 수 있습니다.',
  ],
  certifications: ['vinyl_other', 'haccp'],
} as const;

type AccordionKey = 'shipping' | 'return' | 'product-info';

type Props = {
  category: Product['category'];
  slug: string;
};

export default function ProductAccordions({ category, slug }: Props) {
  const [openSet, setOpenSet] = useState<Set<AccordionKey>>(new Set());
  const { shipping } = useSiteSettings();
  const shippingNotice = shipping.enabled
    ? `기본 배송비 ${shipping.base_fee.toLocaleString('ko-KR')}원 / ${shipping.free_threshold.toLocaleString('ko-KR')}원 이상 구매 시 무료 배송`
    : `배송비 ${shipping.base_fee.toLocaleString('ko-KR')}원`;

  /* 상품 변경 시 전체 닫기 — prop(slug) 기반 동기화 의도의 setState-in-effect. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenSet(new Set());
  }, [slug]);

  const makeToggle = (key: AccordionKey) => (next: boolean) => {
    setOpenSet((prev) => {
      const nextSet = new Set(prev);
      if (next) nextSet.add(key);
      else nextSet.delete(key);
      return nextSet;
    });
  };

  const isOpen = (key: AccordionKey) => openSet.has(key);
  const isDripBag = category === 'Drip Bag';

  return (
    <div id="pd-accordions">
      <Accordion
        label="배송 안내"
        open={isOpen('shipping')}
        onToggle={makeToggle('shipping')}
      >
        <p><strong>평일 오후 2시 이전 주문 시 당일 발송</strong></p>
        <br />
        <p><strong>[ 국내 배송 안내 ]</strong></p>
        <p>{shippingNotice}</p>
        <p>주문 후 평균 1–3 영업일 이내 출고됩니다.</p>
        <p>토·일·공휴일은 발송이 이루어지지 않으며, 다음 영업일에 순차 발송됩니다.</p>
        <br />
        <p>문의사항은 언제든지 편하게 연락해 주세요.</p>
      </Accordion>

      <Accordion
        label="교환 · 반품 안내"
        open={isOpen('return')}
        onToggle={makeToggle('return')}
      >
        <p>원두 특성상 개봉 후에는 교환 및 반품이 불가합니다.</p>
        <p>상품 불량 또는 오배송의 경우 수령일로부터 7일 이내 연락 주시면 처리해 드립니다.</p>
        <p>단순 변심에 의한 반품은 미개봉 상태에서만 가능하며, 왕복 배송비는 고객 부담입니다.</p>
      </Accordion>

      {isDripBag && (
        <Accordion
          label="제품 안내"
          open={isOpen('product-info')}
          onToggle={makeToggle('product-info')}
          bodyClassName="pd-product-info-body"
        >
          <SpecTable rows={DRIP_BAG_SPEC_ROWS} footer={DRIP_BAG_SPEC_FOOTER} />
        </Accordion>
      )}
    </div>
  );
}
