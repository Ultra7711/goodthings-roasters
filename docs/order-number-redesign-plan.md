# 주문번호 생성 모델 재설계 plan (S297 후보)

> 작성: 2026-05-29 (Session 297) · 상태: **트랙 미확정 — 사용자 결정 대기**
> 트리거: 사용자 보고 — "결제화면 도달마다 order_number +1, 미결제 이탈/수량 왕복이 많은 실제 패턴에서 모델이 부적합".

---

## 1. 현 동작 진단 (확정 · 코드/스키마 정독)

### 채번 메커니즘
- `orders.order_number text NOT NULL UNIQUE`, 형식 CHECK `^GT-[0-9]{8}-[0-9]{5}$`.
- INSERT 시 `BEFORE INSERT` 트리거 `set_order_number()` → `nextval('order_number_seq')` → `GT-YYYYMMDD-{seq%100000:05d}`. (`003_orders.sql:42-63, 179-181`)

### 채번 시점
- **"주문하기" 클릭 = form→payment 단계 전환 직전** (결제 시도 前).
  `useCheckoutFlow.handleSubmit` → `createOrder` → `POST /api/orders` → `create_order` RPC → `orders` INSERT (status=`pending`). (`useCheckoutFlow.ts:188`, `010_create_order_rpc.sql:61-109`)

### 토스 orderId 매핑 (흐름별 상이)
- **일반결제(위젯):** 토스 `requestPayment({ orderId: orderNumber })` — order_number 를 그대로 토스 orderId 로 노출. (`CheckoutPayment.tsx:261`)
- **정기결제(빌링):** orderId = `orders.id` (UUID). billing/charge schema `orderId: z.string().uuid()`. (`billing/charge/route.ts:23`, `CheckoutPayment.tsx:234`)
- confirm: `findOrderForConfirm(input.orderId)` — 일반결제는 order_number 로 order 조회. (`paymentService.ts:443`)

### pending 정리
- 토스 결제창 이탈(pageshow persisted / 60s / onBack) → `POST /api/orders/{orderNumber}/cancel` → status=`pending` row **DELETE** (S173, abandon 의미). (`cancel/route.ts`, `CheckoutPayment.tsx:90`)

### 핵심 문제
- **PostgreSQL sequence 는 DELETE/롤백으로 되돌아가지 않음.** pending row 를 지워도 seq 값은 영구 소비.
- 토스 제약(아래 §2)상 결제 시도마다 새 orderId 필수 → order_number=orderId 인 현 구조에선 **수량 왕복·고민 이탈마다 새 번호 채번**.
- 결과: `GT-YYYYMMDD-00071` 의 `00071` 이 "그날 71번째 주문" 으로 보이지만 실제 paid 는 훨씬 적음. paid 번호 띄엄띄엄. **규모 왜곡 + 경쟁사에 매출규모 노출(연속 시퀀스 안티패턴)**.

---

## 2. 업계 표준 리서치 (lessons §2 · 진단 메타 ③ 준수)

### 토스페이먼츠 공식 제약 (불변 — 우회 불가)
- `orderId` 는 **결제 요청 전 생성·저장** 필수 (가맹점 생성, 6~64자, 영숫자·`-`·`_`).
- **한 번 사용한 orderId 재사용 불가** (동일 MID · 미승인이어도 `DUPLICATED_ORDER_ID`).
- 결제 시 위젯에 넘긴 orderId 와 confirm 시 보내는 orderId 는 **동일해야** 함.
- → "결제 시도마다 새 orderId" 는 토스 제약의 직접 결과. 못 피함.

### 업계 관행
- PG 가 결제 전 orderId 를 요구하는 구조에선 "결제 전 식별자 생성" 강제.
- best practice: **PG 전달 orderId(시스템 내부) ↔ 고객 표시 주문번호 분리**.
- 연속 시퀀스 주문번호 노출은 매출규모 노출 → 다수 커머스가 **비연속(랜덤/타임스탬프) 번호** 의도적 채택.
- 단 토스 confirm 의 금액 위변조 방지를 위해 결제 전 `orderId↔기대금액` 서버 저장은 필요 → pending 레코드 자체는 유지.

출처: docs.tosspayments.com (payment-flow, reference), techchat 커뮤니티(orderId·DUPLICATED_ORDER_ID), commercetools checkout, Laracasts.

---

## 3. 두 트랙 비교

### 트랙 A — 비연속 번호 전환 (저비용 · 권장 후보)

**내용:** `order_number` 생성을 sequence → **날짜 + 랜덤** 으로 변경. 예 `GT-YYYYMMDD-XXXXXX` (난수 base32/숫자).

| 항목 | 내용 |
|---|---|
| 변경 지점 | 마이그레이션 1개: `set_order_number()` 트리거 본문 + `orders_number_format` CHECK 정규식. (충돌 시 트리거 내 재생성 루프 또는 INSERT 재시도) |
| 코드 영향 | 거의 없음. 토스 orderId = order_number 유지 가능(랜덤도 6~64자·재사용 안 함). |
| 효과 | "그날 N번째" 연속성 제거 → **부풀어 보임 + 매출규모 노출 동시 해소**. seq 구멍 무의미화. |
| 한계 | 여전히 시도마다 새 번호 채번(토스 제약). 단 번호 "값" 이 비연속이라 왜곡 인식 자체가 사라짐. paid/미결제 구분은 status 로. |
| 회귀 범위 | 기존 paid 주문 번호 = 구형식 → CHECK 를 신·구 형식 모두 허용하거나 기존행 영향 검증. order_number 정규식 의존처(guest-lookup·admin 필터·OrderNumberSchema) 확인. |
| 마이그레이션 | 1개 |

### 트랙 B — orderId ↔ order_number 분리 + paid 시 채번 (고비용 · 정석)

**내용:** 일반결제 토스 orderId = `orders.id`(UUID, 정기결제와 통일). `order_number` 는 **결제 성공(confirm) 시** 채번. 결제 전 pending 은 번호 미부여.

| 항목 | 내용 |
|---|---|
| 변경 지점 | ① 003: `order_number` NOT NULL 완화 + INSERT 트리거 제거 ② 012 confirm_payment RPC: paid 전환 시 order_number 채번 ③ 010 create_order: order_number 반환 제거(id 반환) ④ `findOrderForConfirm`: order_number→id 조회 ⑤ CheckoutPayment: `requestPayment({orderId: id})` ⑥ orderClient/CreateOrderResponse: orderNumber 결제 전 부재 → id 사용 ⑦ useCheckoutFlow: StoredOrderSummary.number 를 confirm 후 갱신 ⑧ order-complete 표시 ⑨ cancel route: id 로 pending 삭제 ⑩ admin orders: pending 행 번호 null 표시 ⑪ guest-lookup: paid 만 번호(영향 적음) |
| 코드 영향 | 결제 핵심(일반·정기·게스트) + admin + 클라 다수 파일 |
| 효과 | order_number 가 **paid 에만 부여 + 연속 가능 + 실 규모 정확 반영** |
| 한계 | 연속 시퀀스 = 매출규모 노출 트레이드오프(원하면 트랙 A 의 랜덤과 결합 가능) |
| 회귀 범위 | 광범위 — 일반/정기/게스트 결제 전 흐름 + confirm 멱등 3중 방어 + admin 목록 + sessionStorage 요약 + 이메일 CTA |
| 마이그레이션 | 2~3개 |

---

## 4. 권장

**기본 권장: 트랙 A.** 사용자 우려(번호 왜곡·부풀어 보임)를 최소 변경·최소 회귀로 해결하고, 업계 표준(비연속 번호로 매출규모 비노출)에도 부합. 토스 제약과 충돌 없음.

**트랙 B 는** "운영상 paid 주문의 연속 일련번호가 꼭 필요(예: 회계/CS 일련 관리)" 일 때만. 결제 핵심 회귀 위험이 크므로 별도 sprint + 에이전트 영향감사 + 단계적 마이그레이션 권장.

> 결합안도 가능: 트랙 B 구조(paid 시 채번) + 번호값은 트랙 A 랜덤 → "paid 에만 + 비연속". 단 비용은 트랙 B.

---

## 5. 미결정 사항 (사용자 확정 필요)

- **DEC-ON-1:** 트랙 A / 트랙 B / 결합 중 선택.
- **DEC-ON-2 (트랙 A 시):** 번호 형식 — `GT-YYYYMMDD-XXXXXX` 랜덤 자릿수·문자셋(숫자만 vs base32). 기존 형식 호환 정책(신·구 CHECK 공존 vs 일괄).
- **DEC-ON-3 (트랙 B 시):** pending 주문을 admin 목록에 노출할지 / 노출 시 번호 자리 표기(예 "결제중").

---

## 7. 트랙 A 상세 설계 (확정 — DEC-ON-1 = 트랙 A)

### 핵심 발견 (영향 최소화 근거)
- `order_number` 형식 정규식이 **이미 `^GT-\d{8}-\d{5,6}$`** (5~6자리 허용 · `011_orders_hardening.sql` 에서 확장).
- 의존처 전부 동일: `OrderNumberSchema`(`schemas/order.ts:144`), `schemas/common.ts:24`, `validation.ts:17`.
- → **6자리 랜덤 숫자**를 쓰면 스키마·CHECK·검증 전부 **무변경**. 코드 변경 0.

### 설계 (DEC-ON-2 권장)
- **형식:** `GT-YYYYMMDD-NNNNNN` — 날짜 유지 + **6자리 랜덤 숫자** (`000000`~`999999`, 일 100만 조합).
  - 숫자만 유지(고객 전화 안내·게스트 조회 입력 호환, base32 혼동문자 회피).
  - 날짜 유지(CS/감사 정렬·가독).
- **채번:** `set_order_number()` 트리거 본문을 `nextval(seq)` → 랜덤 6자리 + 충돌 회피 loop.
  ```
  loop
    candidate := 'GT-' || to_char(now() at tz 'Asia/Seoul','YYYYMMDD') || '-'
                 || lpad((floor(random()*1000000))::int::text, 6, '0');
    exit when not exists (select 1 from orders where order_number = candidate);
  end loop;
  new.order_number := candidate;   -- 최종 UNIQUE 제약이 race 방어
  ```
- **order_number_seq:** 미사용화 → DROP (롤백 안전상 plan 명시. 다른 의존 없음 확인됨).

### 충돌 견고성
- 6자리 = 일 100만 조합. GTR 일 주문 규모 대비 loop 재생성 1회 이내 해결.
- 동시 INSERT 동일 후보 race 는 확률 무시 가능 + `order_number UNIQUE` 가 최종 방어. 위반 시 `create_order` RPC throw → `/api/orders` 오류 → 사용자 재시도. 극히 드물어 수용. (더 견고 원하면 orderService 재시도 래퍼 추가 — 선택)

### 변경 범위
| 파일 | 변경 |
|---|---|
| `supabase/migrations/078_*.sql` (신규) | `set_order_number()` replace (랜덤 6자리 + loop) + `order_number_seq` DROP |
| 코드 | **없음** (정규식 {5,6} 호환, 토스 orderId=order_number 유지, 정렬은 created_at) |

### 검증
- tsc / vitest(스키마 무변경 → 기존 test 그대로) / next build PASS.
- 마이그레이션 적용 후: 신규 주문 번호 형식 `GT-YYYYMMDD-NNNNNN` 6자리 확인 + 연속성 없음 확인.
- 기존 paid 주문 번호(5자리) 불변 + 조회 정상.

### DEC-ON-2 확정값
- 형식 = `GT-YYYYMMDD-` + 6자리 랜덤 숫자. 기존 5자리 = 불변 유지(정규식 {5,6} 공존).

---

## 6. 회귀 체크리스트 골격 (트랙 확정 후 확정)

- [ ] 일반결제: form→payment→토스→confirm→order-complete 번호 일관
- [ ] 정기결제(γ): billing/success→charge 번호 일관 (트랙 B 시 orderId 매핑)
- [ ] 게스트결제: guest-lookup 번호 조회
- [ ] 미결제 이탈: pending DELETE + 번호 부풀음 해소 확인
- [ ] 수량 왕복 후 결제: 번호 동작 정책대로
- [ ] confirm 멱등 3중 방어 회귀 0
- [ ] admin 주문 목록·상세·배송 다이얼로그 번호 표시
- [ ] 주문확인 이메일 CTA(public_token) 무영향
- [ ] tsc / vitest / next build PASS
