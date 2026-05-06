'use client';

import { useCallback, useRef } from 'react';
import type { UserAddress } from '@/types/address';
import { useAddressForm } from '@/hooks/useAddressForm';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { useInputNav } from '@/hooks/useInputNav';
import { shakeFields } from '@/lib/shakeFields';
import { TextField } from '@/components/ui/TextField';
import { SearchIcon } from '@/components/ui/InputIcons';
import { ChevronRight } from '@/components/ui/Icons';
import { useMyPageAddrOpen, setAddrOpen } from '@/lib/myPageUiStore';

type Props = {
  initialAddress: UserAddress | null;
  /** Query 로딩 상태. true 면 "불러오는 중…" placeholder 로 깜빡임 차단. */
  isLoading?: boolean;
  /** 저장 시도 콜백. close/toast 는 호출자(MyPagePage)가 mutation 결과로 처리. */
  onSaved: (addr: UserAddress) => void;
};

export default function AddressSection({ initialAddress, isLoading = false, onSaved }: Props) {
  const isAddrOpen = useMyPageAddrOpen();
  const formRef = useRef<HTMLDivElement>(null);

  const addressForm = useAddressForm({
    initial: initialAddress,
    onSave: onSaved,
  });

  const { setField } = addressForm;
  const { handleChangeValue: handlePhoneChange } = usePhoneFormat(
    useCallback((v: string) => setField('phone', v), [setField]),
  );
  const nav = useInputNav(formRef);

  const open = useCallback(() => {
    addressForm.reset(initialAddress);
    setAddrOpen(true);
  }, [addressForm, initialAddress]);

  const hasAddress = !!initialAddress;
  const addrDisplay = isLoading && !hasAddress
    ? '불러오는 중…'
    : initialAddress
      ? `(${initialAddress.zipcode}) ${initialAddress.addr1}${initialAddress.addr2 ? ` ${initialAddress.addr2}` : ''}`
      : '등록된 배송지 정보가 없습니다.';
  const isPlaceholderText = !hasAddress; /* 로딩·빈 상태 모두 회색 (#9C9890) */

  return (
    <div className="mp-info-row mp-info-row--addr">
      <div
        className="mp-info-row-top"
        role="button"
        tabIndex={0}
        aria-label={isAddrOpen ? '닫기' : hasAddress ? '주소 편집' : '새 주소 추가'}
        aria-busy={isLoading || undefined}
        onClick={() => (isAddrOpen ? setAddrOpen(false) : open())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isAddrOpen) setAddrOpen(false);
            else open();
          }
        }}
      >
        <span className="mp-info-label">배송지 정보</span>
        <div className="mp-info-addr-right">
          <span
            className="mp-info-value mp-info-addr-text"
            style={isPlaceholderText ? { color: '#9C9890' } : undefined}
          >
            {addrDisplay}
          </span>
          <span className="mp-addr-icon-btn" aria-hidden="true">
            <span className={`mp-chevron${isAddrOpen ? ' open' : ''}`}>
              <ChevronRight />
            </span>
          </span>
        </div>
      </div>
      <div className={`mp-form-reveal${isAddrOpen ? ' open' : ''}`}>
        <div className="mp-form-reveal-inner" ref={formRef}>
          <TextField
            label="받는 분"
            value={addressForm.form.name}
            onChange={(v) => addressForm.setField('name', v)}
            onClear={() => addressForm.setField('name', '')}
            onKeyDown={nav}
            error={addressForm.errors.name}
            helper="받는 분의 이름을 입력하세요."
          />
          <TextField
            type="tel"
            label="전화번호"
            value={addressForm.form.phone}
            onChange={handlePhoneChange}
            onClear={() => addressForm.setField('phone', '')}
            onBlur={addressForm.blurPhone}
            onKeyDown={nav}
            error={addressForm.errors.phone}
            helper="하이픈이 자동으로 입력됩니다."
          />
          <div className="chp-addr-inline">
            <TextField
              label="주소 검색"
              readOnly
              style={{ cursor: 'pointer', paddingRight: 36 }}
              value={addressForm.form.addr1}
              onChange={() => { /* readOnly */ }}
              onClick={addressForm.lookupAddress}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addressForm.lookupAddress();
                }
              }}
              wrapperClass={addressForm.form.addr1 ? 'has-value' : ''}
              customAction={
                <button
                  className="chp-addr-search-btn"
                  type="button"
                  title="주소 검색"
                  onClick={addressForm.lookupAddress}
                >
                  <SearchIcon />
                </button>
              }
              error={addressForm.errors.addr1}
              helper="주소를 검색해 주세요."
            />
            <TextField
              label="우편번호"
              maxLength={5}
              inputMode="numeric"
              value={addressForm.form.zipcode}
              onChange={(v) => addressForm.setField('zipcode', v)}
              hideClear
              error={addressForm.errors.zipcode}
              helper="주소 검색 시 자동 입력됩니다."
            />
          </div>
          {addressForm.form.addr1 && (
            <TextField
              label="상세주소"
              value={addressForm.form.addr2}
              onChange={(v) => addressForm.setField('addr2', v)}
              onClear={() => addressForm.setField('addr2', '')}
              onKeyDown={nav}
              helper="동·호수 등 상세주소를 입력하세요."
            />
          )}
          <div className="mp-form-reveal-actions">
            <button
              className="mp-cancel-btn"
              type="button"
              onClick={() => setAddrOpen(false)}
              data-gtr-tap
            >
              취소
            </button>
            <button
              className="mp-save-btn"
              type="button"
              onClick={() => {
                addressForm.submit();
                setTimeout(() => shakeFields(formRef.current), 0);
              }}
              data-gtr-tap
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
