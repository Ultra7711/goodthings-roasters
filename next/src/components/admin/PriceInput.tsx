'use client';

/* ══════════════════════════════════════════════════════════════════════════
   PriceInput — admin 가격 입력 표준 (S231 폴리싱)

   - 입력 허용: 숫자 / 숫자+콤마 / 숫자+콤마+"원" — 모두 숫자만 추출
   - 표시 형식: 66,000원 (toLocaleString('ko-KR') + 단위 "원")
   - value 0 또는 빈 값일 때 placeholder 노출
   - inputMode="numeric" — 모바일 숫자 키보드

   사용 예 (정수 모드):
     <PriceInput value={price} onChange={setPrice} />

   사용 예 (문자열 모드 — display_price 등):
     <PriceInput
       value={parseInt(s.replace(/[^\d]/g, ''), 10) || 0}
       onChange={(n) => setStr(n > 0 ? `${n.toLocaleString('ko-KR')}원` : '')}
     />
   ══════════════════════════════════════════════════════════════════════════ */

import { Input } from '@/components/admin/ui/input';

type Props = {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

export function PriceInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: Props) {
  const display = value > 0 ? `${value.toLocaleString('ko-KR')}원` : '';
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        onChange(raw === '' ? 0 : parseInt(raw, 10));
      }}
      className={className}
    />
  );
}
