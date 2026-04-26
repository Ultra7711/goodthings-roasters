# BUG-115 결제수단 옵션 Z 확장 — 설계 문서

> 2026-04-27 / S85 작성. 다음 세션부터 PR1 → PR2 순서로 구현.

---

## 1. 배경

### 현재 구조의 결함

토스 결제위젯(`widgets.renderPaymentMethods` + `variantKey: 'DEFAULT'`)이 어드민에 활성화된 7개 결제수단(퀵계좌이체·신용·체크카드·tosspay·PAYCO·KakaoPay·NaverPay·ApplePay)을 **자체 UI 안에서 통합 노출**하는 구조다. 그런데 우리는 그 위에 별도 라디오 탭(`체크/신용카드` vs `계좌이체/무통장입금`)을 두어 **사용자 선택을 우리가 클라이언트에서 제어한다고 착각**하는 UI를 운영해왔다.

실제로:
1. 라디오 선택은 결제 흐름에 영향을 주지 않는다 (토스 위젯이 자체 UI로 결제수단을 받음).
2. 사용자가 토스 위젯에서 간편결제 5종(toss/kakao/naver/payco/apple) 중 하나를 선택하면 → 백엔드 `paymentService.ts:319-323` 의 `method_mismatch` 검증에 걸려 **결제 실패**.
3. 매핑 테이블(`TOSS_METHOD_TABLE`)이 `card`/`transfer` 만 지원. 코드 주석은 "MVP 범위 밖 → method_mismatch 거부" 명시.
4. `014_settlement_report.sql:162` 의 `get_method_breakdown` 함수가 이미 "future easy_pay" 를 가정한 설계를 갖고 있음 (확장 친화적).

### 목표

- **라디오 탭 제거** (Step 1-a). 토스 위젯 UI 에 일임.
- **DB enum + provider 컬럼 확장**. 카드/계좌이체/간편결제 3분류 + 간편결제는 9종 provider 별 집계 가능.
- **method_mismatch 비교 검증 제거 + DB update 로직**. webhook method 가 권위.
- **이메일 라벨 매핑 확장**.

---

## 2. 토스 응답 ENUM (공식 문서 근거)

### `method` 필드

| 한글 | 영문 | 비고 |
|------|------|------|
| 카드 | CARD | |
| 간편결제 | EASY_PAY | 카드 기반/선불 기반 모두 이 값 |
| 가상계좌 | VIRTUAL_ACCOUNT | |
| 휴대폰 | MOBILE_PHONE | 본 PR 범위 외 |
| 계좌이체 | TRANSFER | |
| 문화상품권 / 도서문화상품권 / 게임문화상품권 | CULTURE_GIFT_CERTIFICATE 등 | 본 PR 범위 외 |

### `easyPay.provider` 필드 (간편결제 시)

| 한글 | 영문 | 본 PR 처리 |
|------|------|---------|
| 토스페이 / 토스결제 | TOSSPAY | ✅ |
| 네이버페이 | NAVERPAY | ✅ |
| 카카오페이 | KAKAOPAY | ✅ |
| 페이코 | PAYCO | ✅ |
| 애플페이 | APPLEPAY | ✅ |
| 삼성페이 | SAMSUNGPAY | ✅ (어드민 비활성 상태여도 enum 등록) |
| 엘페이 | LPAY | ✅ |
| SSG페이 | SSG | ✅ |
| 핀페이 | PINPAY | ✅ |

> 원칙: 토스가 정의한 9종을 모두 enum 에 등록. 어드민 활성화/비활성화는 운영 결정이고, DB enum 은 미래 확장에도 견고하도록 모두 포함.

### 출처
- [토스페이먼츠 ENUM 코드](https://docs.tosspayments.com/reference/enum-codes)
- [간편결제 응답 확인하기](https://docs.tosspayments.com/guides/v2/easypay-response)
- [퀵계좌이체 | 토스페이먼츠](https://www.tosspayments.com/services/accountpay)

---

## 3. DB 설계 (마이그레이션 023)

### 3.1 enum 확장

```sql
-- payment_method 확장
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'easypay';

-- easypay_provider 신규
CREATE TYPE public.easypay_provider AS ENUM (
  'tosspay',
  'kakaopay',
  'naverpay',
  'payco',
  'samsungpay',
  'lpay',
  'ssgpay',
  'applepay',
  'pinpay'
);
```

### 3.2 컬럼 추가

```sql
ALTER TABLE public.orders
  ADD COLUMN easypay_provider public.easypay_provider;

ALTER TABLE public.payments
  ADD COLUMN easypay_provider public.easypay_provider;
```

> `payment_transactions` 테이블에는 추가하지 않는다. payments 1행이 환불 트랜잭션 다수를 지배하므로 method/provider 는 payments 단위로 충분.

### 3.3 CHECK 제약 변경

#### `orders_transfer_fields` 교체

기존(003_orders.sql:139-145):
```sql
CHECK (
  (payment_method = 'transfer' AND bank_name IS NOT NULL AND depositor_name IS NOT NULL)
  OR
  (payment_method = 'card' AND bank_name IS NULL AND depositor_name IS NULL)
)
```

신규(023):
```sql
ALTER TABLE public.orders DROP CONSTRAINT orders_transfer_fields;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_fields CHECK (
  -- card: 결제 정보 컬럼 모두 NULL
  (payment_method = 'card'
    AND bank_name IS NULL
    AND depositor_name IS NULL
    AND easypay_provider IS NULL)
  OR
  -- transfer: bank/depositor 는 webhook 에서 채울 수 있고 미수신도 가능 → NULL 허용
  --          easypay_provider 는 NULL
  (payment_method = 'transfer'
    AND easypay_provider IS NULL)
  OR
  -- easypay: provider 필수, bank/depositor NULL
  (payment_method = 'easypay'
    AND bank_name IS NULL
    AND depositor_name IS NULL
    AND easypay_provider IS NOT NULL)
);
```

> 변경 핵심: `transfer` 의 `bank_name IS NOT NULL` 강제 제약 완화. Step 1-a 에서 클라이언트가 더 이상 입력 받지 않기 때문. webhook 으로부터 받을 수 있으면 채우고 미수신 시 NULL 유지.

#### `payments_virtual_secret_required` 변경

기존(012_payments_hardening.sql:91-92):
```sql
CHECK (method <> 'transfer' OR webhook_secret IS NOT NULL)
```

신규: 변경 없음. 기존 제약은 "transfer 면 webhook_secret 필수" 로, easypay 는 영향 없음. ✅

### 3.4 account_delete 함수 영향

`015_account_delete.sql:116-117` 의 PII 마스킹은 `bank_name` / `depositor_name` 만 처리. easypay_provider 는 PII 가 아니므로 마스킹 불필요. 다만 일관성을 위해 다음 한 줄 추가 가능:

```sql
-- 015 와 별도 마이그레이션에서:
-- (PII 가 아니므로 필수 아님. Step 2 에서 정밀화)
```

### 3.5 create_order RPC (017_create_order_rpc_created_at.sql) 영향 판단

**클라이언트가 항상 `p_payment_method='card'`, `p_bank_name=NULL`, `p_depositor_name=NULL` 송신할 것이므로, RPC 시그니처는 변경 불필요.**

webhook 시점에 update:
```sql
UPDATE public.orders
SET payment_method = $1,        -- webhook method (card/transfer/easypay)
    easypay_provider = $2       -- easypay 일 때만, 그 외 NULL
WHERE id = $3;
```

이 update 는 `paymentService.ts` 의 결제 승인 처리 함수에서 수행. (현재 paymentService 가 어떻게 update 하는지 정밀 추적 필요 — Step 2에서 확인 후 PR1 작업)

### 3.6 get_method_breakdown (014) 자동 호환

enum 에 `easypay` 추가 시 `get_method_breakdown` 함수는 자동으로 `easypay` 행을 반환. **변경 불필요**. ✅

provider 별 집계는 별도 함수 신설:

```sql
-- 023 또는 별도 마이그레이션
CREATE FUNCTION public.get_easypay_provider_breakdown(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE (
  provider public.easypay_provider,
  approved_count integer,
  approved_amount bigint
) ...
```

> 사용자 요구사항 "결제수단별 집계"의 핵심. 본 PR1 범위에 포함.

---

## 4. 백엔드 코드 변경 (PR1 본체)

### 4.1 `paymentService.ts`

#### 매핑 테이블 확장

```ts
// 기존:
const TOSS_METHOD_TABLE: Readonly<Record<string, DbPaymentMethod>> = {
  카드: 'card', CARD: 'card', card: 'card',
  가상계좌: 'transfer', 계좌이체: 'transfer',
  VIRTUAL_ACCOUNT: 'transfer', TRANSFER: 'transfer',
};

// 신규 항목 추가:
간편결제: 'easypay',
EASY_PAY: 'easypay',
```

#### Provider 매핑 신규

```ts
const TOSS_PROVIDER_TABLE: Readonly<Record<string, EasypayProvider>> = {
  토스페이: 'tosspay', 토스결제: 'tosspay', TOSSPAY: 'tosspay',
  네이버페이: 'naverpay', NAVERPAY: 'naverpay',
  카카오페이: 'kakaopay', KAKAOPAY: 'kakaopay',
  페이코: 'payco', PAYCO: 'payco',
  애플페이: 'applepay', APPLEPAY: 'applepay',
  삼성페이: 'samsungpay', SAMSUNGPAY: 'samsungpay',
  엘페이: 'lpay', LPAY: 'lpay',
  SSG페이: 'ssgpay', SSG: 'ssgpay',
  핀페이: 'pinpay', PINPAY: 'pinpay',
};

function mapEasyPayProvider(provider: string | undefined): EasypayProvider | null {
  if (!provider) return null;
  return TOSS_PROVIDER_TABLE[provider] ?? null;
}
```

#### `method_mismatch` 검증 변경 (line 319-323)

```ts
// 기존:
if (method !== order.payment_method) {
  throw new PaymentServiceError(
    'method_mismatch',
    `expected=${order.payment_method},actual=${method}`,
  );
}

// 신규: 비교 검증 제거.
// 매핑 실패(mapTossMethod === null) 시는 기존대로 method_mismatch 유지 (보안 검증).
// webhook 의 method 가 권위 → order.payment_method 를 update.
```

#### Update 로직 추가

`confirmPayment` 또는 동등 함수에서:
- `method === 'easypay'` 시 `provider = mapEasyPayProvider(tossResponse.easyPay?.provider)`. provider null 이면 → 새 에러 코드 `easypay_provider_missing`.
- `orderRepo.updatePaymentMethod(orderId, method, provider)` 호출.

### 4.2 `orderRepo.ts`

```ts
async function updatePaymentMethod(
  orderId: string,
  method: DbPaymentMethod,
  provider: EasypayProvider | null,
): Promise<void> {
  // UPDATE orders SET payment_method = $1, easypay_provider = $2 WHERE id = $3
}
```

### 4.3 `types/db.ts`

```ts
export type DbPaymentMethod = 'card' | 'transfer' | 'easypay';
export type EasypayProvider =
  | 'tosspay' | 'kakaopay' | 'naverpay' | 'payco'
  | 'samsungpay' | 'lpay' | 'ssgpay' | 'applepay' | 'pinpay';
```

### 4.4 이메일 템플릿 (`email/notifications.ts`, `email/templates/orderConfirmationEmail.ts`)

```ts
const PAYMENT_METHOD_LABEL: Record<DbPaymentMethod, string> = {
  card: '신용/체크카드',
  transfer: '계좌이체/가상계좌',
  easypay: '간편결제',
};

const EASYPAY_PROVIDER_LABEL: Record<EasypayProvider, string> = {
  tosspay: '토스페이',
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  payco: '페이코',
  applepay: '애플페이',
  samsungpay: '삼성페이',
  lpay: 'L.pay',
  ssgpay: 'SSG페이',
  pinpay: '핀페이',
};

function paymentMethodLabel(method: DbPaymentMethod, provider: EasypayProvider | null): string {
  if (method === 'easypay' && provider) {
    return `${EASYPAY_PROVIDER_LABEL[provider]} (간편결제)`;
  }
  return PAYMENT_METHOD_LABEL[method];
}
```

---

## 5. 클라이언트 변경 (PR2 본체 — Step 1-a)

### 5.1 `CheckoutPage.tsx`

제거 대상 (line 707-762, ~55줄):
- `<div className="chp-section ...">결제수단</div>` 블록 전체
- 관련 핸들러: `handlePaymentSwitch`, `handleBankChange`, `payFade`, `payFadeTimerRef`
- 상수: `BANKS` (다른 곳 미사용 시), `InfoIcon` (다른 곳 미사용 시)

### 5.2 `useCheckoutForm.ts`

- `paymentMethod` 필드 → 제거 또는 type-only 유지
- `bankName`, `depositorName` 필드 → 제거
- `setPaymentMethod` 콜백 → 제거
- `validate()` 의 `transfer` 분기 → 제거

### 5.3 `types/checkout.ts`

```ts
// 제거:
export type PaymentMethod = 'card' | 'transfer';

// CheckoutFormData 에서 제거:
paymentMethod: PaymentMethod;
bankName: string;
depositorName: string;
```

### 5.4 `orderClient.ts buildOrderPayload`

```ts
// 기존(line 169-173):
form.paymentMethod === 'transfer'
  ? { ...payment, bankName: form.bankName.trim(), depositorName: form.depositorName.trim() }
  : payment

// 신규: payment.method 항상 'card' 고정 송신, bank/depositor 모두 미송신.
//      백엔드에서 webhook 수신 후 method 를 정확한 값으로 update.
const payment = {
  method: 'card' as const,
  // bankName/depositorName 제거
};
```

### 5.5 `globals.css`

`.chp-payment-*` 클래스 정리 (~50줄 추정):
- `.chp-payment-methods`
- `.chp-payment-indicator`
- `.chp-payment-item`
- `.chp-payment-method`
- `.chp-payment-detail`
- `.chp-card-notice`
- `.chp-card-notice-icon`

---

## 6. 테스트 변경

### 6.1 `webhookService.test.ts`

- `payment_method: 'card'` 케이스 → `method='easypay'` webhook 으로 도착하는 시나리오 추가
- 기존 `method_mismatch` 케이스 의미 변경 — 매핑 실패 (e.g. `MOBILE_PHONE`) 만 method_mismatch 로 거부

### 6.2 `orderClient.test.ts`

- `paymentMethod: 'transfer'` 케이스 페이로드 변경 (bank/depositor 미송신)

### 6.3 `paymentService` 단위 테스트 (없으면 신규)

- `mapEasyPayProvider` 테스트 9종 + null
- `confirmPayment` update 호출 검증

---

## 7. PR 분할 명세

### PR1: 백엔드 + DB (선행 배포)

**파일**:
- `supabase/migrations/023_payment_easypay_support.sql` (신규)
- `next/src/lib/services/paymentService.ts`
- `next/src/lib/repositories/orderRepo.ts`
- `next/src/lib/repositories/paymentRepo.ts` (필요 시)
- `next/src/types/db.ts`
- `next/src/lib/email/notifications.ts`
- `next/src/lib/email/templates/orderConfirmationEmail.ts`
- `next/src/lib/services/webhookService.test.ts`

**호환성**: PR1 배포 시점에 클라이언트는 여전히 `paymentMethod: 'card' | 'transfer'` 라디오로 동작. PR1 의 백엔드는 client 의 `card`/`transfer` 도, 그리고 webhook 의 `easypay` 도 모두 처리.

**검증 시나리오**:
- 카드 결제 → 정상
- 퀵계좌이체 결제 → method='transfer' webhook → bank_name/depositor_name 채움 (또는 NULL 허용)
- KakaoPay/TossPay/NaverPay/PAYCO/ApplePay 결제 → method='easypay' + provider → 정상 처리
- get_method_breakdown / get_easypay_provider_breakdown 집계 정상

### PR2: 클라이언트 정리 (PR1 안정 배포 후)

**파일**:
- `next/src/components/checkout/CheckoutPage.tsx`
- `next/src/hooks/useCheckoutForm.ts`
- `next/src/types/checkout.ts`
- `next/src/lib/api/orderClient.ts`
- `next/src/lib/api/orderClient.test.ts`
- `next/src/app/globals.css`

**호환성**: PR2 배포 시 클라이언트는 항상 `paymentMethod: 'card'` 송신. PR1 백엔드가 이를 받아 webhook 으로 정확한 method/provider 로 update.

**검증 시나리오**:
- UI 에 결제수단 라디오 없음 확인
- 토스 위젯에서 카드/계좌이체/간편결제 선택 → 정상 결제
- 주문 완료 페이지·이메일에 정확한 결제수단 표시

### 이행 순서

1. **PR1 작성** → `database-reviewer` 에이전트 호출 (마이그레이션 안전성 검증)
2. PR1 머지 → 프로덕션 배포
3. **24~48 시간 모니터링**: 결제 시 method/provider 정상 처리, 로그 확인
4. **PR2 작성** → `code-reviewer` 에이전트 호출
5. PR2 머지 → 배포

---

## 8. 위험 요소 / 미결 사항

### 8.1 `transfer` 의 bank_name/depositor_name webhook 채움 가능성

토스 가상계좌 webhook 은 `customerName` 등 입금자 정보를 알려주지만, 정확한 구조 미확인. PR1 작업 시 확인 필요. 미확인 시 일단 NULL 허용 (CHECK 제약 완화) 으로 충분.

### 8.2 카드 기반 vs 선불 기반 간편결제

토스 문서에 의하면 카드 기반 간편결제도 method='간편결제'(EASY_PAY) 로 응답될 수 있음. 본 PR1 에서는 모두 `'easypay'` 로 분류. 카드/포인트 비율 같은 세부 정보는 `payments.raw_response` (jsonb) 에서 확인 가능.

### 8.3 RPC 시그니처 동결

본 설계는 RPC 시그니처 변경 없이 진행하지만, 향후 클라이언트가 method 를 정확히 알릴 수 있게 되면 RPC 시그니처에 `p_easypay_provider` 추가 검토.

### 8.4 코드 검증 누적

직전 세션들에서 자동 리뷰 누락. PR1 작성 시:
- `database-reviewer` (마이그레이션 + RPC 안전성)
- `security-reviewer` (webhook signature, provider 매핑 보안)
- `typescript-reviewer` (백엔드 코드)

PR2 작성 시:
- `code-reviewer` (UI 제거 + 잔존물)

---

## 9. 작업 시간 추산

| 단계 | 추정 |
|------|------|
| PR1 마이그레이션 작성 | 1.5h |
| PR1 백엔드 코드 변경 | 2h |
| PR1 테스트 업데이트 | 1.5h |
| PR1 리뷰 + 수정 | 1h |
| PR2 클라이언트 코드 정리 | 1.5h |
| PR2 CSS 정리 + 검증 | 0.5h |
| PR2 리뷰 + 수정 | 0.5h |
| **합계** | **~8.5h** (2~3 세션 분량) |

---

## 10. 참조

- 본 설계 작성 세션: S85 (2026-04-27)
- 보고: `docs/bug-and-polishing.md` BUG-115
- 관련 코드:
  - `next/src/components/checkout/CheckoutPage.tsx:707-762`
  - `next/src/components/checkout/CheckoutPayment.tsx:100-103`
  - `next/src/lib/services/paymentService.ts:115-134, 315-324`
  - `supabase/migrations/003_orders.sql:35-38, 96, 139-145`
  - `supabase/migrations/014_settlement_report.sql:160-220`
- 토스 공식 문서:
  - https://docs.tosspayments.com/reference/enum-codes
  - https://docs.tosspayments.com/guides/v2/easypay-response
  - https://docs.tosspayments.com/guides/v2/payment-widget/admin
