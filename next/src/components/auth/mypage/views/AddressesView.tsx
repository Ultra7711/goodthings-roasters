/* ══════════════════════════════════════════
   AddressesView — 주소록 view (S197 PR-1.3.B)
   현재 단일 default 주소 (S174). 다중 주소는 후속 PR.
   ══════════════════════════════════════════ */

'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import type { UserAddress } from '@/types/address';
import { useDefaultAddressQuery, useSaveDefaultAddress } from '@/hooks/useDefaultAddress';
import { setAddrOpen } from '@/lib/myPageUiStore';
import AddressSection from '../AddressSection';

export default function AddressesView() {
  const { show: toast } = useToast();
  const { data: addressData, isPending: isAddressLoading } = useDefaultAddressQuery();
  const saveAddress = useSaveDefaultAddress();

  const handleSaveAddress = useCallback(
    (addr: UserAddress) => {
      saveAddress.mutate(addr, {
        onSuccess: () => {
          setAddrOpen(false);
          toast('배송지가 저장되었습니다.');
        },
        onError: (err) => {
          console.error('[mypage.address] save failed', err);
          toast('배송지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        },
      });
    },
    [saveAddress, toast],
  );

  return (
    <div className="mp-section-body">
      <AddressSection
        initialAddress={addressData ?? null}
        isLoading={isAddressLoading}
        onSaved={handleSaveAddress}
      />
    </div>
  );
}
