/* ══════════════════════════════════════════
   sections/ShippingSubForm.tsx — Section 1: 무료 배송 정책 (S256-A 분리)

   - 기준 금액 + 기본 배송비 2 input
   - 메인 사이트 장바구니/결제/마이페이지에 즉시 반영 (참고 박스)
   ══════════════════════════════════════════ */

import type { ShippingSettings } from '@/lib/siteSettings';
import { SettingsCard } from '../_shared/SettingsCard';
import { FormField } from '../_shared/FormField';
import { FormInput } from '../_shared/FormInput';
import { formatNumber, parseNumber } from '../_shared/helpers';

interface ShippingSubFormProps {
  value: ShippingSettings;
  onChange: (patch: Partial<ShippingSettings>) => void;
}

export function ShippingSubForm({ value, onChange }: ShippingSubFormProps) {
  return (
    <SettingsCard
      title="무료 배송 정책"
      subtitle="장바구니 임계 금액 이상에서 자동 적용 · 공지 배너 자동 모드의 기준 금액"
      on={value.enabled}
      onToggle={() => onChange({ enabled: !value.enabled })}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="기준 금액" hint="이 금액 이상 결제 시 무료">
            <FormInput
              suffix="원 이상"
              inputMode="numeric"
              value={formatNumber(value.free_threshold)}
              onChange={(e) =>
                onChange({ free_threshold: parseNumber(e.target.value) })
              }
            />
          </FormField>
          <FormField label="기본 배송비" hint="장바구니 · 상품 상세 · 법적 고지(배송/반품 정책)에 자동 반영">
            <FormInput
              suffix="원"
              inputMode="numeric"
              value={formatNumber(value.base_fee)}
              onChange={(e) =>
                onChange({ base_fee: parseNumber(e.target.value) })
              }
            />
          </FormField>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--info-soft)] border border-[var(--info-border)] flex gap-3 items-start text-xs text-[var(--info)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-[1px]"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div>
            <div className="font-medium text-[#1F4F8B]">참고</div>
            <div className="mt-0.5 text-[var(--info)]">
              변경 시 메인 사이트 장바구니 · 결제하기 · 마이페이지 모두 즉시 반영됩니다. (페이지 새로고침 후)
            </div>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
