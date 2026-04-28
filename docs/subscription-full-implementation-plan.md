# 정기배송 풀 구현 계획 (Subscription Full Implementation Plan)

> **작성일:** 2026-04-27 (Session 92 진단 기준)
> **갱신일:** 2026-04-27 (어드민 의존성 반영)
> **상태:** 어드민 풀 구현 (`docs/admin-implementation-plan.md`) 후속 작업. 어드민 인프라·상품 도메인 DB 전환 완료 후 진입.
> **결정 배경:** 클라이언트(사업자) 정기배송 출시 시점 미확정 → 출시 전까지 "최대한 준비". 자동 결제 집행은 Phase 3 (출시 후) 보류.

---

## 0-0. 선행 의존성 (S92 정책 변경 반영)

본 계획서는 `docs/admin-implementation-plan.md` 의 후속 작업이다. 다음 어드민 작업이 완료된 후 진입:

- **어드민 인프라** (admin plan Group A) — `/admin/login`, layout, RBAC 가드
- **상품 도메인 DB 전환** (admin plan Group E-1~E-4) — `lib/products.ts` 하드코딩 → DB
  - 현재 `subscriptions` 테이블이 상품 정보를 스냅샷으로 보관 (product_slug·product_name·product_image_src) 하고 있어, 상품 도메인 DB 전환 후 정기배송 흐름의 스냅샷 소스가 DB 가 됨
- **어드민 정기배송 UI** (admin plan Group D) — 본 계획서의 사용자 측 흐름 완성 후 진행

---

## 0. 진단 요약 (현재 코드 상태)

### 0-1. 현황 매트릭스

| 영역 | DB 테이블 | 결제→DB INSERT | API GET 목록 | UI 연동 |
|------|-----------|---------------|--------------|---------|
| **주문 내역** | ✅ `orders`+`order_items` (003·004) | ✅ `create_order` RPC 작동 | ❌ **미구현** | ❌ MOCK |
| **정기배송** | ✅ `subscriptions` (005) | ❌ **결제 시 INSERT 안 됨** | ❌ **미구현** | ❌ MOCK |

### 0-2. 검증 결과 (2026-04-27 기준)

- ✅ DB enum `public.subscription_period`: `'2주'·'4주'·'6주'·'8주'` (3주 없음 — `004_order_items.sql` L18~23)
- ⚠️ UI 타입 `SubscriptionCycle`: `'2주'·'3주'·'4주'·'6주'·'8주'` (3주 있음 — `next/src/types/subscription.ts`) → **DB 와 불일치**
- ✅ `create_order` RPC (`010_create_order_rpc.sql`) 는 `order_items.item_type='subscription'` 까지만 기록. `subscriptions` 테이블 INSERT 코드 없음
- ✅ `POST /api/orders` (P2-A-2) 만 존재. `GET /api/orders` (사용자별 목록) 미구현
- ✅ `/api/subscriptions` 디렉토리 자체 미존재
- ✅ 어드민 UI 디렉토리 (`next/src/app/admin/`) 미존재. 어드민 API 는 `/api/admin/me` + `/api/admin/orders/[orderNumber]/ship` 만
- ✅ 결제 흐름 `cartService` → `orderService` 의 `item_type='subscription'` 분기는 작동 중 (cart → order_items 까지)
- ⚠️ `SUB_DISCOUNTS`·`discountRate`·`originalPriceNum` 현재 코드 미존재 (`memory/project_subscription_discount_ui.md` 35일 전 메모리는 outdated — 어느 시점에 제거됨)
- ⚠️ production Supabase 마이그레이션 005·019~024 적용 여부 미확인 (S91 사고로 018 미적용 발견된 사례 있음)

### 0-3. 005 마이그레이션 주석에 명시된 결정

> "자동 결제 집행은 Phase 3. 본 테이블은 '구독 계약' 만 관리." — `005_subscriptions.sql` L7

→ 본 계획서는 이 결정을 그대로 따른다. 자동 결제 집행 (스케줄러·빌링키·재시도)은 Phase 3 (출시 후 클라이언트 운영 시점) 로 미룸.

---

## 1. 작업 그룹

### 🔴 Group A — 인프라 정합성 (전제 조건)

| # | 작업 | 추정 | 비고 |
|---|------|------|------|
| **A-1** | production Supabase 마이그레이션 005·019~024 적용 여부 검증·동기화 | 30~60m | S91 사고 재발 방지. SQL Editor 또는 supabase CLI 사용 |
| **A-2** | `subscription_period` enum 불일치 해소 — UI 타입 (`'2주'·'3주'·'4주'·'6주'·'8주'`) ≠ DB enum (`'2주'·'4주'·'6주'·'8주'`) | 30m | 정책 결정 필요 — UI 에서 3주 제거 OR DB enum 확장 |
| **A-3** | (선택) ADR-005 결정 — cycle 을 lookup 테이블로 이관할지 enum 유지할지 | 1~2h | 어드민 편집 필요시 후보 B (lookup 테이블) 채택. `memory/project_adr005_subscription_cycles_queue.md` 참조 |

### 🟠 Group B — 결제 흐름 → 정기배송 INSERT (단절된 흐름 복구)

| # | 작업 | 추정 |
|---|------|------|
| **B-1** | `create_order` RPC 확장 — `order_items.item_type='subscription'` 인 행에 대해 `subscriptions` row 자동 INSERT (트랜잭션 내) | 2~3h |
| **B-2** | `subscriptions.next_delivery_at` 계산 로직 — 정책 결정 필요 (즉시 vs 다음 영업일 vs 결제 후 N일) | 1h (정책+코드) |
| **B-3** | `orderService.ts` — RPC 호출 결과에 subscription 결과 반영 + 단위 테스트 | 1~2h |
| **B-4** | `/order-complete` 또는 마이페이지 진입 시 "정기배송 N건 등록" 안내 UI | 30m |
| **B-5** | 동일 상품·동일 cycle 중복 구독 차단 — DB unique partial index (`status='active'` 한정) 또는 서비스 검증 | 1h |

### 🟡 Group C — 마이페이지 연동 (사용자 관리 API)

> **S99 UI 선행 완료 (2026-04-29):**
> `MyPagePage.tsx` 에 다음 UI 가 MOCK 상태로 구현됨. 백엔드 API 완성 후 C-6 에서 실제 연동 교체.
> - 구독 아코디언 3버튼 레이아웃 `[배송 건너뛰기 | 구독 해지 | 취소/저장]` (flex 2:1.5:1)
> - 배송 건너뛰기 확인 모달 — `calcNextDate(currentDate, cycle)` 헬퍼로 다음 배송일 계산 후 표시
> - 구독 해지 확인 모달 — danger CTA (`--color-error` 배경)
> - `CYCLE_DAYS` 상수 및 `calcNextDate()` 순수 함수 컴포넌트 상단에 정의

| # | 작업 | 추정 | 비고 |
|---|------|------|------|
| **C-1** | `GET /api/orders` (사용자별, 페이지네이션, RLS) | 1~2h | |
| **C-2** | `GET /api/subscriptions` (사용자별, 활성·일시중지·해지 분리) | 1h | |
| **C-3** | `PATCH /api/subscriptions/:id` (cycle 변경 + `next_delivery_at` 재계산) | 1h | UI 완료 (S99 MOCK) |
| **C-4** | `DELETE /api/subscriptions/:id` (soft cancel — `status='cancelled'` + `cancelled_at`) | 30m | UI 완료 (S99 MOCK — 해지 확인 모달) |
| **C-5** | `POST /api/subscriptions/:id/skip` (1회 배송 건너뛰기 — `next_delivery_at` += cycle_days, `skip_count` 증가) | 1h | UI 완료 (S99 MOCK — 다음 배송일 표시 확인 모달). cycle_days 는 `CYCLE_DAYS` 상수 기준 (14/21/28/42/56일) |
| **C-6** | `POST /api/subscriptions/:id/pause` + `/resume` (일시중지·재개) | 1h | |
| **C-7** | `MyPagePage` MOCK_ORDERS·MOCK_SUBSCRIPTIONS → `useQuery`/`useMutation` 교체 | 2h | C-3~C-5 UI 는 이미 완성 — API 연결만 교체 |
| **C-8** | 빈 상태·로딩·에러 UI + 낙관적 업데이트 | 1h | |
| **C-9** | 회원 탈퇴 흐름 — 활성 구독 있을 시 차단 (이미 `confirmWithdraw` 에 409 분기 있음, 검증만) | 30m | |

### 🟢 Group D — 도메인 정합성 보강 (출시 전 필수)

| # | 작업 | 추정 |
|---|------|------|
| **D-1** | 정기배송 할인 정책 확정 + 데이터 구조 + UI 노출 (35일 전 메모리 outdated — 데이터 구조도 신규 도입 필요) | 정책 + 2~4h |
| **D-2** | 다음 배송일 표시 포맷 통일 (`YYYY.MM.DD` vs `M월 D일` 등) + 타임존 (KST 고정) | 30m |
| **D-3** | 마이페이지 주문 카드에서 일반 주문 vs 정기배송 주문 구분 UI | 30m |
| **D-4** | E2E 테스트 — 정기배송 결제 → DB INSERT → 마이페이지 노출 흐름 | 2h |

### ⏸ Group E — 자동 결제 집행 (Phase 3 — 출시 후)

> 005 마이그레이션 주석에 명시: "자동 결제 집행은 Phase 3"

| # | 작업 |
|---|------|
| **E-1** | Toss 자동 결제 키 (빌링키) 발급 흐름 — 결제 위젯 정식 신청 시 옵션 추가 신청 필요 |
| **E-2** | 빌링키 보관 — `payments.billing_key` 또는 별도 `user_billing_keys` 테이블 |
| **E-3** | 정기배송 자동 결제 스케줄러 — Vercel Cron / Supabase pg_cron / 외부 큐 |
| **E-4** | 자동 결제 실패 처리 — retry 정책·status `paused` 자동 전환·사용자 알림 |
| **E-5** | 정기배송 자동 주문 생성 — `create_order` 변형 (사용자 인증·결제 인증 우회 + 빌링키 결제) |
| **E-6** | 배송 발송 알림 (다음 배송 N일 전 미리 안내) |

### ⏸ Group F — 어드민 (별도 계획서로 이관)

> S92 정책 변경: 어드민 풀 구현이 출시 전 작업으로 승격됨. 본 그룹은 `docs/admin-implementation-plan.md` Group D 로 이관·통합.
>
> - 어드민 정기배송 목록·강제 해지·일시중지·수동 조정 → admin plan Group D-1·D-2
> - 자동 결제 실패 모니터링 → admin plan Group D-3 (Phase 3 보류 유지)
> - 정기배송 통계 → 출시 후 V2
> - SOP 문서 → admin plan Group G-1 통합

### ⏸ Group G — 알림 (Phase 3 — 출시 후)

| # | 작업 |
|---|------|
| **G-1** | 정기배송 등록 완료 메일 (Resend) |
| **G-2** | 다음 배송 N일 전 안내 메일 |
| **G-3** | 자동 결제 성공·실패 메일 |
| **G-4** | 해지 확인 메일 |

---

## 2. 권장 진행 순서 (어드민 풀 구현 후속)

> S92 정책 변경: 어드민 풀 구현 (`admin-implementation-plan.md` 약 56~80h) 이 본 계획보다 선행. 본 계획은 어드민 작업 S-7 단계로 통합됨.

| 단계 | 범위 | 추정 | 산출 |
|------|------|------|------|
| **(어드민 S-1~S-6 후)** | 어드민 인프라·주문·사용자·상품 DB 전환·메뉴 완료 (`admin-implementation-plan.md` 참조) | 56~80h | 상품 DB 전환 완료, 어드민 출시 가능 |
| **S-7-1** | A-1 + A-2 (정기배송 인프라 정합성) | 1~1.5h | enum 정합 + production 마이그 동기화 |
| **S-7-2** | B-1 + B-2 + B-3 + B-5 (결제→subscriptions INSERT) | 4~6h | 정기배송 결제 흐름 백엔드 완성 |
| **S-7-3** | C-1 + C-2~C-6 (사용자 API 8종 — 건너뛰기 포함) | 5~6h | 사용자 관리 API 완성 |
| **S-7-4** | C-7 + C-8 + B-4 + D-1 (마이페이지 UI 교체 + 할인 UI) | 3~4h | C-3~C-5 UI 완성(S99)으로 단축 |
| **S-7-5** | D-2 + D-3 + D-4 + 인수 검증 | 2~3h | 정기배송 사용자 흐름 출시 가능 |
| **S-8** | 어드민 정기배송 UI (admin plan Group D) | 4~6h | 정기배송 운영 가능 |
| **(보류)** | E·G — 자동 결제·알림 | 큼 | Phase 3 (출시 후 V2) |

→ **본 계획서 분량 약 14~19시간** (S-7-1 ~ S-7-5)
→ **어드민 + 정기배송 풀 = 약 70~97시간** (admin plan §3-2 합계)

> **백엔드 작업 시작 시점에 본 계획서를 다시 검토하고 일정 재산정 필요.** 어드민 작업 진행 결과 (특히 상품 DB 스키마) 에 따라 정기배송 작업 범위 변동 가능.

---

## 3. 클라이언트 의사결정 필요 항목

S92~S95 진행 중·후에 클라이언트(사업자)에게 확정 받을 사항:

1. **정기배송 출시 시점** — 출시 직후? N개월 후?
2. **할인율 정책** — 35일 전 메모리에 있던 `{'2':0, '4':0.05, '6':0.08, '8':0.10}` 그대로? 다른 값? 적용 안 함?
3. **첫 배송일 정책** — 결제 즉시 발송 후 다음 cycle? 결제 후 N일 뒤 첫 발송?
4. **주기 옵션** — DB enum 의 `2·4·6·8주` 만? UI 에 있는 `3주` 추가?
5. **자동 결제 SLA** — 빌링키 결제 실패 시 재시도 정책 (시점·횟수)
6. **해지 정책** — 즉시 해지 vs 다음 배송일까지 유지 vs 환불 처리

---

## 4. 관련 파일·메모리 인덱스

### 코드
- `next/src/types/subscription.ts` — UI 타입 (DB enum 과 불일치 — A-2 대상)
- `next/src/lib/mockMyPageData.ts` — `MOCK_ORDERS`·`MOCK_SUBSCRIPTIONS` (C-6 교체 대상)
- `next/src/components/auth/MyPagePage.tsx` — 마이페이지 (C-6/C-7 대상)
- `next/src/lib/services/orderService.ts` — `item_type='subscription'` 분기 (B-3 확장 대상)
- `next/src/lib/services/cartService.ts` — 카트 정기배송 분기 (참조)
- `next/src/app/api/orders/route.ts` — POST 만 존재 (C-1 GET 추가 대상)
- `supabase/migrations/004_order_items.sql` — `subscription_period` enum 정의
- `supabase/migrations/005_subscriptions.sql` — `subscriptions` 테이블 (Phase 3 주석 명시)
- `supabase/migrations/010_create_order_rpc.sql` — `create_order` RPC (B-1 확장 대상)

### 메모리
- `memory/project_adr005_subscription_cycles_queue.md` — A-3 결정 자료
- `memory/project_subscription_discount_ui.md` — D-1 자료 (⚠️ 35일 전, outdated — 데이터 구조 미존재 확인됨)
- `memory/project_payment_user_guide_needed.md` — F-5 와 함께 작성

### 문서
- `docs/backend-architecture-plan.md` — 레이어 분리 원칙
- `docs/payments-flow.md` — 결제 흐름 (E 그룹과 연결)
- `docs/milestone.md` — 마일스톤 추적

---

## 5. 변경 이력

| 날짜 | 세션 | 변경 내용 |
|------|------|----------|
| 2026-04-27 | S92 | 초기 작성 (진단 + 작업 리스트 + 권장 순서) |
| 2026-04-27 | S92 | 어드민 풀 구현 정책 변경 반영 — Group F (어드민) 를 `admin-implementation-plan.md` 로 이관, 진행 순서를 어드민 후속으로 재배치 |
| 2026-04-29 | S99 | Group C UI 선행 완료 반영 — 구독 아코디언 3버튼(배송 건너뛰기·구독 해지·취소/저장) + 확인 모달 2종(S99 MOCK). C-5 배송 건너뛰기 API 항목 신규 추가. C-7→C-8(UI), C-6→C-7(pause/resume) 번호 재정렬. S-7-3·S-7-4 추정 시간 보정 |
