/* ══════════════════════════════════════════
   AddressSection — 배송지
   받는 분 / 전화번호 / 주소 검색 / 우편번호 / 상세주소 / 배송 메시지.
   ══════════════════════════════════════════ */

'use client';

import type { KeyboardEvent } from 'react';
import * as Select from '@radix-ui/react-select';

type InputNavHandler = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
import { TextField } from '@/components/ui/TextField';
import { SearchIcon } from '@/components/ui/InputIcons';
import type { CheckoutFormData, CheckoutErrors } from '@/types/checkout';

const DELIVERY_OPTIONS = [
  { value: '경비실', label: '부재 시 경비실에 맡겨 주세요.' },
  { value: '문앞', label: '부재 시 문 앞에 놓아 주세요.' },
  { value: '택배함', label: '부재 시 택배함에 넣어 주세요.' },
  { value: '직접수령', label: '직접 받겠습니다. 배송 전 연락 부탁드립니다.' },
  { value: '파손주의', label: '파손 위험 상품입니다. 취급에 주의해 주세요.' },
  { value: 'direct', label: '직접 입력' },
] as const;

function ChevronDown({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6,9l6,6,6-6" />
    </svg>
  );
}

type AddressFields = Pick<
  CheckoutFormData,
  'firstname' | 'phone' | 'zipcode' | 'addr1' | 'addr2' | 'deliveryMessage' | 'deliveryCustom'
>;

type AddressErrors = Pick<CheckoutErrors, 'firstname' | 'phone' | 'zipcode' | 'addr1'>;

type AddressSectionProps = {
  form: AddressFields;
  errors: AddressErrors;
  onChange: <K extends keyof CheckoutFormData>(key: K, value: CheckoutFormData[K]) => void;
  onPhoneChange: (v: string) => void;
  onBlurPhone: () => void;
  onKeyDown: InputNavHandler;
  onAddressSearch: () => void;
};

export default function AddressSection({
  form,
  errors,
  onChange,
  onPhoneChange,
  onBlurPhone,
  onKeyDown,
  onAddressSearch,
}: AddressSectionProps) {
  return (
    <div className="chp-section chp-section--no-border">
      <h2 className="chp-section-title">배송지</h2>
      {/* 받는 분 */}
      <TextField
        label="받는 분"
        value={form.firstname}
        onChange={(v) => onChange('firstname', v)}
        onClear={() => onChange('firstname', '')}
        onKeyDown={onKeyDown}
        error={errors.firstname}
        helper="받는 분의 이름을 입력하세요."
      />
      {/* 전화번호 */}
      <TextField
        type="tel"
        label="전화번호"
        value={form.phone}
        onChange={onPhoneChange}
        onClear={() => onChange('phone', '')}
        onBlur={onBlurPhone}
        onKeyDown={onKeyDown}
        error={errors.phone}
        helper="하이픈이 자동으로 입력됩니다."
      />
      {/* 주소 */}
      <div className="chp-addr-inline">
        <TextField
          label="주소 검색"
          readOnly
          autoComplete="off"
          style={{ cursor: 'pointer', paddingRight: 36 }}
          value={form.addr1}
          onChange={() => { /* readOnly */ }}
          onClick={onAddressSearch}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddressSearch(); } }}
          wrapperClass={form.addr1 ? 'has-value' : ''}
          customAction={
            <button className="chp-addr-search-btn" type="button" title="주소 검색" onClick={onAddressSearch}>
              <SearchIcon />
            </button>
          }
          error={errors.addr1}
          helper="주소를 검색해 주세요."
        />
        <TextField
          label="우편번호"
          maxLength={5}
          inputMode="numeric"
          autoComplete="off"
          value={form.zipcode}
          onChange={(v) => onChange('zipcode', v.replace(/\D/g, ''))}
          onKeyDown={onKeyDown}
          hideClear
          helper="주소 검색 시 자동 입력됩니다."
        />
      </div>
      {/* 상세주소 — 주소 입력 후 표시 */}
      {form.addr1 && (
        <TextField
          label="상세주소"
          value={form.addr2}
          onChange={(v) => onChange('addr2', v)}
          onClear={() => onChange('addr2', '')}
          onKeyDown={onKeyDown}
          helper="동·호수 등 상세주소를 입력하세요."
        />
      )}
      {/* 배송 메시지 드롭다운 — Radix Select (키보드 ↑↓ · Enter 지원) */}
      <div className={`chp-field chp-dropdown-field${form.deliveryMessage ? ' has-value' : ''}`}>
        <Select.Root
          value={form.deliveryMessage}
          onValueChange={(v) => onChange('deliveryMessage', v)}
        >
          <Select.Trigger className="chp-dropdown-trigger" aria-label="배송 메시지 선택">
            <Select.Value />
            <Select.Icon asChild>
              <span className="chp-dropdown-arrow" aria-hidden="true"><ChevronDown /></span>
            </Select.Icon>
          </Select.Trigger>
          <label className="chp-floating-label">배송 메시지 (선택사항)</label>
          <Select.Portal>
            <Select.Content className="chp-select-content" position="popper" sideOffset={0}>
              <div className="chp-dropdown-title">배송 메시지 선택</div>
              <Select.Viewport>
                {DELIVERY_OPTIONS.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value} className="chp-select-item">
                    <Select.ItemText>{opt.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
      {/* 직접 입력 */}
      {form.deliveryMessage === 'direct' && (
        <TextField
          label="배송 메시지를 입력해 주세요."
          value={form.deliveryCustom}
          onChange={(v) => onChange('deliveryCustom', v)}
          onClear={() => onChange('deliveryCustom', '')}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}
