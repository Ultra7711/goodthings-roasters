/* ══════════════════════════════════════════
   useAddressForm
   마이페이지 주소 인라인 편집 상태 관리
   프로토타입 #mp-addr-accordion 로직 이식
   - 받는 분·전화번호·우편번호·기본주소·상세주소 5필드
   - 주소 검색 버튼 클릭 시 더미 주소 주입 (Phase 2-F에서 Daum Postcode API 연동)
   - 저장 시 useAuthStore.updateAddress 호출
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useState } from 'react';
import type { UserAddress } from '@/types/address';
import { EMPTY_ADDRESS } from '@/types/address';
import { isValidPhone, isValidZipcode } from '@/lib/validation';

/** 더미 주소 (Phase 2-F에서 Daum Postcode API로 교체) */
const DUMMY_LOOKUP_ADDRESS = {
  zipcode: '06035',
  addr1: '서울특별시 강남구 가로수길 12',
} as const;

export type AddressFormErrors = Partial<Record<keyof UserAddress, string>>;

type UseAddressFormOptions = {
  /** 편집 시작 시 기존 값으로 초기화 */
  initial?: UserAddress | null;
  /** 저장 버튼 클릭 시 호출 (검증 통과 후) */
  onSave: (address: UserAddress) => void;
};

export function useAddressForm({ initial, onSave }: UseAddressFormOptions) {
  const [form, setForm] = useState<UserAddress>(initial ?? EMPTY_ADDRESS);
  const [errors, setErrors] = useState<AddressFormErrors>({});

  const setField = useCallback(
    <K extends keyof UserAddress>(field: K, value: UserAddress[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  /** 편집 시작: 기존 값 로드 + 에러 초기화 */
  const reset = useCallback((next: UserAddress | null) => {
    setForm(next ?? EMPTY_ADDRESS);
    setErrors({});
  }, []);

  /** 주소 검색 (더미) */
  const lookupAddress = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      zipcode: DUMMY_LOOKUP_ADDRESS.zipcode,
      addr1: DUMMY_LOOKUP_ADDRESS.addr1,
    }));
    setErrors((prev) => {
      if (!prev.zipcode && !prev.addr1) return prev;
      const next = { ...prev };
      delete next.zipcode;
      delete next.addr1;
      return next;
    });
  }, []);

  /** 검증 + 저장 */
  const submit = useCallback((): boolean => {
    const newErrors: AddressFormErrors = {};
    const trimmed: UserAddress = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      zipcode: form.zipcode.trim(),
      addr1: form.addr1.trim(),
      addr2: form.addr2.trim(),
    };

    if (!trimmed.name) {
      newErrors.name = '이름을 입력해 주세요.';
    }

    if (!trimmed.phone) {
      newErrors.phone = '전화번호를 입력해 주세요.';
    } else if (!isValidPhone(trimmed.phone)) {
      newErrors.phone = '올바른 전화번호 형식을 입력해 주세요.';
    }

    if (!trimmed.addr1) {
      newErrors.addr1 = '주소를 검색해 주세요.';
    }

    if (!trimmed.zipcode) {
      newErrors.zipcode = '우편번호를 입력해 주세요.';
    } else if (!isValidZipcode(trimmed.zipcode)) {
      newErrors.zipcode = '우편번호는 5자리 숫자입니다.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    onSave(trimmed);
    return true;
  }, [form, onSave]);

  return {
    form,
    errors,
    setField,
    reset,
    lookupAddress,
    submit,
  };
}
