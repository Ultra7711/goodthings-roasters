/* ══════════════════════════════════════════
   admin/bizInquiries.ts — 비즈 문의 라벨 변환 (S250-3)
   biz.ts 의 옵션(value→label)을 재사용해 어드민 표시용 한글 라벨 해석.
   ══════════════════════════════════════════ */

import {
  BIZ_TYPE_OPTIONS,
  BIZ_VOLUME_OPTIONS,
  BIZ_CYCLE_OPTIONS,
  BIZ_PRODUCT_OPTIONS,
  type BizDropdownOption,
} from '@/lib/biz';
import type { BizInquiryStatus } from './bizInquiriesServer';

function resolveLabel(options: BizDropdownOption[], value: string | null): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export const describeBizType = (v: string | null) => resolveLabel(BIZ_TYPE_OPTIONS, v);
export const describeBizVolume = (v: string | null) => resolveLabel(BIZ_VOLUME_OPTIONS, v);
export const describeBizCycle = (v: string | null) => resolveLabel(BIZ_CYCLE_OPTIONS, v);
export const describeBizProducts = (values: string[]): string =>
  values.length === 0 ? '—' : values.map((v) => resolveLabel(BIZ_PRODUCT_OPTIONS, v)).join(', ');

export const BIZ_STATUS_LABEL: Record<BizInquiryStatus, string> = {
  pending: '신규',
  contacted: '연락중',
  closed: '종결',
};

/* 상태 전이 순서 — UI 다음 상태 버튼용 */
export const BIZ_STATUS_ORDER: BizInquiryStatus[] = ['pending', 'contacted', 'closed'];
