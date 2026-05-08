/* ══════════════════════════════════════════
   ProfileView — 프로필 view (S197 PR-2 §2.7)
   AccountInfoRow (이름·이메일) + AddressSection (단일 default 주소).
   비밀번호 변경은 AccountView 로 이관, 주소록 nav 폐기로 단일 주소 sub-section 흡수.
   ══════════════════════════════════════════ */

'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import type { UserAddress } from '@/types/address';
import { useDefaultAddressQuery, useSaveDefaultAddress } from '@/hooks/useDefaultAddress';
import { setAddrOpen } from '@/lib/myPageUiStore';
import AccountInfoRow from '../AccountInfoRow';
import AddressSection from '../AddressSection';

type Props = {
  name: string;
  email: string;
};

export default function ProfileView({ name, email }: Props) {
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
      <AccountInfoRow name={name} email={email} />
      <AddressSection
        initialAddress={addressData ?? null}
        isLoading={isAddressLoading}
        onSaved={handleSaveAddress}
      />
    </div>
  );
}
