# 적립금(포인트) 시스템 구현 계획

> 작성: S323 · 상태: 계획(구현 미착수)
> 착수: **라이브 전**(유저 유입 전 결제 인프라 완성 — 결제 흐름 변경은 유저 유입 후가 더 위험). 단 행동 적립(리뷰·생일)의 *실효*는 모수 유입 후.
> 근거 backlog: `memory/project_points_system_backlog.md` · 자체 DB 확정(S319)

---

## 1. 개요

포인트는 **현금과 직결**된다. 따라서 이 시스템은 결제 무결성(S260 하드닝)과 **동급 보안 설계**로 다룬다. 핵심 3축:
1. **적립(earn)** — 결제 + 행동(가입·리뷰·생일 등)
2. **사용(redeem)** — 결제 시 현금처럼 차감(서버 재계산 통합)
3. **연동** — 자체 DB(`point_ledger` 원장 + 잔액). 외부 서비스 미사용.

---

## 2. 정책 결정 (DEC)

| ID | 결정 | 값 |
|----|------|-----|
| DEC-P1 | **적립 시점** | **구매 확정(배송완료) 후** — 취소/환불 시 미적립 상태라 회수 불필요(단순). 적립 예정액은 `pending`으로 표시 가능 |
| DEC-P2 | **적립률** | **어드민 설정**(`site_settings.points.earn_rate`) — 코드 하드코딩 금지. 초기값은 운영 시작 시 확정 |
| DEC-P3 | **만료** | **구조는 만료 지원**(`expires_at`)·**초기 무만료**(어드민 OFF). 켤 때 FIFO 차감 + 소멸 사전 고지(전상법). 🔶 글로벌 무만료 흔하나 한국 1년 다수 |
| DEC-P4 | **적립 트리거** | 결제·가입·리뷰·생일 등 **전부 어드민 on/off + 값 설정**. 리뷰/생일 실효는 라이브 후(모수 의존) |
| DEC-P5 | **연동** | 자체 DB 확정 |
| DEC-P6 | **게스트** | 미적립·미사용(`user_id` 필수) — 게스트는 식별자 없음 |
| DEC-P7 | **사용 자격** | 로그인 회원만. 최소 사용액·단위·할인 병용 = 어드민 설정 |

> 정책을 `site_settings`에 두는 이유: 배송비(`site_settings.shipping`)가 이미 같은 패턴(어드민 동적·`fetchSiteSettings` 폴백). 일관성 + 재배포 없이 조정.

---

## 3. 🔒 보안 위협 모델 + 방어 (핵심)

포인트=현금이므로 위협을 명시하고 각각 방어한다.

| # | 위협 | 방어 |
|---|------|------|
| T1 | **클라이언트가 사용 포인트액 조작**(많이 썼다고 위조) | `orderService` **서버 재계산** — 클라 입력 무시, 실잔액 조회 후 `min(요청, 잔액, 결제액)` (`orderService.ts:217-232` discountAmount 통합점) |
| T2 | **잔액 초과 사용**(음수 잔액) | RPC 내 `SELECT ... FOR UPDATE` 잔액 검증 + `point_balance >= 0` CHECK 제약 |
| T3 | **이중 사용/적립(race·재시도)** | `point_ledger.idempotency_key UNIQUE`(주문ID·이벤트 기반) + 행 잠금. 결제 멱등 3중 패턴 답습 |
| T4 | **DB 직접 조작**(클라가 ledger/balance INSERT) | `point_ledger`·잔액 갱신 = **RLS service_role 전용**(`force row level security`·정책 미선언=차단). 클라는 조회만. `payments` 패턴 답습 |
| T5 | **부정 적립**(자기 적립·중복 적립) | 적립은 서버 트리거(배송완료 전이)에서만. 주문 1건=1적립(idempotency=order_id). 행동 적립도 서버 검증 |
| T6 | **환불 악용**(적립받고 환불로 빼먹기) | DEC-P1(배송완료 후 적립)로 원천 완화 — 환불은 배송 전이 대부분이라 미적립. 사용분은 `reversed` 이벤트로 정확 복원 |
| T7 | **회계 불일치**(ledger≠잔액) | 잔액=ledger 트리거 동기화 + **정기 reconciliation**(`SUM(amount)` 대조 배치/쿼리). 불일치 시 알림 |
| T8 | **정책 조작**(적립률 변조) | `site_settings.points`는 owner-only 어드민(RBAC `055`) + audit 로그 |

**원칙**: 모든 포인트 변동은 **service_role RPC를 통해서만**. 클라이언트·일반 authenticated는 잔액/내역 **조회만**. 직접 쓰기 경로 0.

---

## 4. 아키텍처

```
[체크아웃] --pointsToUse--> [orderService(서버 재계산)] --검증--> [create_order RPC v2]
                                                                      |
                                                  point_ledger('used', -N) + 잔액 차감 (원자)
[배송완료 전이] --> [earn RPC] --> point_ledger('earned', +N, idempotency=order_id) + 잔액 가산
[환불 webhook] --> [apply_webhook_event 확장] --> point_ledger('reversed') 사용분 복원
[어드민] --> [adjust RPC] --> point_ledger('adjusted', ±N) + audit
```

- **원장(point_ledger)**: append-only 불변 이력(감사·분쟁·reconciliation 근거)
- **잔액(비정규화)**: 빠른 조회용. 트리거로 ledger와 동기화. (업계 표준: ledger+balance 분리)

---

## 5. DB 스키마 (마이그 090~, 기존 패턴 답습)

| # | 마이그 | 내용 |
|----|--------|------|
| 090 | enum + 잔액 | `point_event_type`('earned'/'used'/'expired'/'adjusted'/'reversed'/'earn_pending') · `point_source` · `profiles.point_balance int default 0 CHECK(>=0)` |
| 091 | `point_ledger` | append-only. `id·user_id·order_id?·event_type·amount(±)·source·idempotency_key UNIQUE·expires_at?·reversing_id?·description·created_at`. 인덱스(user_id·order_id·expires_at) |
| 092 | RLS | `point_ledger`·잔액 갱신 = service_role 전용(`force`·정책 미선언). 본인 조회는 `point_ledger_select_own`(SELECT만) |
| 093 | 잔액 트리거 | `sync_point_balance`(ledger INSERT AFTER → 잔액 ±). `prevent_balance_negative` |
| 094 | 포인트 RPC | `earn_points`·`use_points`·`reverse_points`·`adjust_points`·`expire_points`(FIFO) — 전부 `security definer`·멱등 |
| 095 | create_order RPC v2 | `p_points_used` 인자 추가 → 'used' ledger INSERT + 잔액 차감 원자화(017·026 답습) |
| 096 | 정책 설정 | `site_settings.points`(earn_rate·earn_timing·expiry_months·triggers·min_redeem·max_redeem_ratio) — 032 답습 |
| 097 | 환불 reversal | `apply_webhook_event` 확장(012 답습) — refund 시 사용분 복원 |

> 🔶 구현 전 직접 재검증: `create_order` RPC 시그니처(010·017·026), `apply_webhook_event`(012), `profiles`(001), `site_settings`(032) 실제 구조.

---

## 6. 서비스 레이어

| 파일 | 변경/신규 |
|------|-----------|
| `lib/services/pointService.ts` (신규) | `computeEarnAmount`(정책 기반·순수)·`getBalance`·`previewRedeem`(사용 가능액 계산)·환불 reversal. DI 가능(테스트) |
| `lib/services/orderService.ts` | `:231` `discountAmount = 0` → 포인트 사용 통합. 서버 잔액 검증 후 `min`. `create_order` v2 호출 |
| 배송완료 적립 훅 | 주문 status→delivered 전이(`016_shipping_dispatch` 경로) 시 `earn_points` 호출(idempotency=order_id) |
| 환불 | `apply_webhook_event` 확장 — 사용분 `reversed` |
| `types/point.ts`·`types/db.ts` | `PointEventType`·`PointLedgerEntry`·`PointBalance` enum/타입 |
| `lib/utils` | `formatPoints()` |

---

## 7. 어드민 (owner-only)

- **정책 설정**: 적립률·적립시점·만료·트리거 on/off·최소사용액 (`site_settings.points` 편집 UI·032 패턴)
- **수동 가감**: 특정 회원 ±포인트(분쟁/보상)·사유 기록 → `adjust_points` RPC + audit
- **내역 조회**: 회원별 ledger·전체 발행/사용 집계(`settlement_report` 연동 — 포인트 부채 현황)

---

## 8. 프론트엔드 — UI 표시 위치 매핑 (사용자 동선 전체)

> 클라 표시는 전부 **UX용**. 금액 권위는 항상 서버 재계산(`orderService`). 적립률·트리거가 어드민 설정이라 표시값도 **`site_settings.points` 기반 동적**.

| # | 위치 | 컴포넌트(경로) | 표시 내용 |
|---|------|----------------|-----------|
| U1 | **상품 상세(PDP)** | `product/ProductDetailPage.tsx`·`product/PurchaseRow.tsx` | 구매 시 **적립 예정 포인트**("구매 적립 N P") — 가격 근처. 적립 OFF면 숨김 |
| U2 | **장바구니** | `cart/CartClient.tsx`·`cart/CartDrawer.tsx` | 예상 적립 포인트(소계 기준) |
| U3 | **체크아웃 — 사용** | `checkout/OrderSummary.tsx`·`checkout/CheckoutPayment.tsx` | **보유 잔액 + 사용 입력**(부분/전액 버튼)·최소사용액 가드·**사용 후 결제액 미리보기**(`previewRedeem`) |
| U4 | **체크아웃 — 적립 안내** | `checkout/OrderSummary.tsx` | 이번 주문 **적립 예정**(배송완료 후 지급 문구·DEC-P1) |
| U5 | **주문완료** | `checkout/OrderCompletePage.tsx`·`OrderCompleteHero.tsx` | 사용 포인트 + 적립 예정 포인트 안내 |
| U6 | **마이페이지 대시보드** | `auth/mypage/HeroGreeting.tsx`·`MyPagePanel.tsx` | **보유 포인트 잔액**(눈에 띄게)·적립 예정(pending) 합계 |
| U7 | **마이페이지 — 포인트 내역**(신규 view) | `auth/mypage/views/PointsView.tsx`(신규)·`MyPageSideNav.tsx`(메뉴 추가) | 적립/사용/만료 **ledger 이력** + **소멸 예정**(만료 ON 시) |
| U8 | **주문내역** | `auth/mypage/OrderHistory.tsx`·`views/OrdersView.tsx` | 주문별 **사용/적립 포인트** 표시 |
| U9 | **헤더(선택)** | `layout/SiteHeader.tsx` | 로그인 시 잔액 노출(선택·디자인 검토) |

**신규 프론트 자산**: `views/PointsView.tsx`(내역)·`MyPageSideNav` 메뉴 항목·잔액/적립예정 표시 컴포넌트(공용)·`useUserPoints` 훅(`getBalance`/`previewRedeem`)·`formatPoints()`.

**비로그인/게스트**: U1·U2의 적립 예정은 "로그인 시 적립" 안내로, U3 사용은 로그인 유도(게스트 미적립·DEC-P6/P7).

### 어드민 설정 ↔ UI 표시 연동 (DEC-P8 · `site_settings.points` 플래그)

UI 표시는 **전부 어드민 설정에 연동**된다(재배포 0). 배송비 `shipping.enabled` 마스터 토글 패턴 답습.

| 플래그 | OFF 시 효과 |
|--------|-------------|
| **`points.enabled`** (마스터) | **U1~U9 전부 숨김** — 시스템 미가동. **라이브 전 구축 후 정책 확정 전까지 OFF로 두면 흔적 0**(안전) |
| `earn.enabled` | 적립 표시(U1·U2·U4·U5·U8 적립분) 숨김 |
| `redeem.enabled` | 체크아웃 사용 UI(U3) 숨김 |
| `expiry.enabled` | 소멸 예정(U7) 숨김 |
| 트리거별(`signup`·`review`·`birthday`) | 해당 적립 안내·지급 on/off |
| `earn_rate`(값) | 표시 적립액 **동적 반영**(예: 1%→2% 변경 시 PDP 적립예정 즉시 반영) |

→ **운영 시나리오**: 라이브 전 = `points.enabled=false`(코드만 존재·UI 0) → 정책 확정 후 어드민에서 ON + 적립률 설정 → 전 UI 자동 노출. 끄고 싶으면 마스터 OFF 1번으로 전체 숨김.

---

## 9. 멱등·동시성·회계 무결성

- **멱등**: 적립=order_id 기반 key·사용=order 기반·재시도 안전(결제 3중 멱등 답습)
- **동시성**: 잔액 변경 RPC는 `SELECT ... FOR UPDATE`(동시 결제 race 차단)
- **회계**: `SUM(point_ledger.amount) == profiles.point_balance` 불변식. reconciliation 쿼리(정기) + 트리거 보장. 포인트 부채(미사용 발행액) 정산 리포트

---

## 10. 구현 Phase (제안)

| Phase | 범위 | 검증 |
|-------|------|------|
| P1 ✅ | 스키마(090~095) + `pointService`(순수 로직) | RPC 멱등·잔액 음수 차단·RLS 차단 단위/통합 |
| **P2 (진행)** | `orderService` 사용 통합 + pending 폐기 복원 + `complete_delivery`(배송완료 전이+적립 훅). **§13 S325 패치 참조** | 사용액 서버 재계산·잔액 검증·복원 멱등·적립 idempotency |
| P3 | 환불 reversal (사용분 복원·`apply_webhook_event` 확장) | 사용분 복원·이중복원 차단 |
| P4 | 어드민(정책·수동가감·내역·audit) | owner-only·audit 기록 |
| P5 | 프론트(잔액·체크아웃·마이페이지) | E2E 적립→사용→환불 사이클 |
| P6 | 회계 reconciliation + 부하/동시성 테스트 | ledger=잔액 불변식·동시 결제 |

---

## 11. 검증 전략

- **단위**: `pointService` 순수 함수(적립액 계산·사용 가능액·정책 적용)
- **통합**: RPC 멱등(재호출 시 1회만)·동시성(FOR UPDATE)·RLS(클라 직접 쓰기 차단)·음수 방지
- **E2E**: 적립(배송완료)→사용(체크아웃)→환불(복원) 전체 사이클
- **보안**: T1~T8 각 위협별 테스트 케이스(조작·초과·이중·직접조작 시도)
- **회계**: reconciliation(ledger SUM = 잔액)

---

## 12. 잔여 결정·carry (구현 착수 시 확정)

- 적립률·최소 사용액·만료 기간 **초기값**(어드민 설정이라 코드 무관·운영 결정)
- 적립 단위·소수점 처리(원 단위 정수 권장)
- 할인/쿠폰 병용 규칙(현재 쿠폰 없음 — 포인트 단독)
- 정기배송(subscription) 적립/사용 정책
  - **기간별 차등 적립률**(2주/4주/6주/8주 cycle별 rate) — 가능·P4 이연. 구조 수용됨:
    정책 JSONB 확장(Zod `earn.subscription_rates`) + `computeEarnAmount`→항목별 `computeEarnForItems`
    (order_items.subscription_period 기반) + 어드민 UI. **098 RPC·테이블 마이그 변경 불요**
    (적립액은 앱 계산→RPC 기록만). ❓착수 시 확인: 반복 회차가 회차별 주문→complete_delivery 를
    타는지 vs 별도 적립 트리거 필요(042 process_billing_charge_success 흐름 정밀 확인).
- 적립 예정(pending) 노출 방식
- 토스 라이브 키 없이 테스트 가능 범위(포인트 로직 자체는 결제와 분리 테스트 가능)

---

## 13. S325 Phase 2 착수 패치 (Δ1~Δ5 · 코드 직독 재검증 결과)

> 착수 시 코드 직독(orderService·orderRepo·create_order[017]·dispatch_order[016]·confirm_payment[075]·012 전이 트리거·094 RPC)으로 §4~§6를 재검증한 결과, 계획이 빠뜨렸거나 모호한 6개 지점을 확정한다. **이 섹션이 P2에 한해 §4~§6·§10을 보강·우선한다.**

### 핵심 결정 (사용자 승인)

- **DEC-S325-1 사용분 차감 시점 = 주문 생성(pending) 시점**(option 1 채택). 생성 시 `FOR UPDATE` 즉시 차감 → 중복 사용 원천 차단. `confirm_payment`(최고 하드닝 RPC) 미수정. 대신 pending 폐기/취소 경로 복원 필수(Δ1).
  - 대안(paid 확정 시 차감)은 동일 유저 pending 2건 동시 진행 시 확정 시점 잔액부족 갭(Toss 청구 후 처리 곤란) + confirm_payment 수정 필요 → 기각.

### Δ1. pending 폐기 시 사용 포인트 복원 (계획 §4·§5 누락분)

생성 시 차감의 필연적 짝. `point_ledger.order_id`는 `on delete set null`이라, 복원 없이 주문을 삭제/취소하면 **잔액이 영구 차감된 채로 남음(현금 손실 = CRITICAL)**. 차감(`used` −R) 후 주문이 paid 도달 못 하면 반드시 `reversed` +R 복원.

**복원 경로(착수 시 037/038 직독 후 확정):**
- `deletePendingOrderForUser`(앱코드 3-step) → **`delete_pending_order` RPC화**(복원+삭제 원자). 유저가 Toss 위젯 이탈 시.
- `delete_stale_pending_orders`(038 cron) / `sweep_stale_pending_orders`(012 fallback) → 취소·삭제 대상 중 `points_used>0` 이면 `reversed` 복원 ledger 동반(set-based, 멱등 `idempotency_key='restore:'||order_id`).
- 037(cancel_stale)·039(일회성·적용완료)는 직독 후 활성 여부 판정.

복원 source = `refund`(090 enum 재사용·`description`에 'order_cancelled_points_restored'). 신규 enum 값 추가 안 함(KISS). 멱등키로 이중 복원 차단.

### Δ2. `shipping→delivered` 전이 신설 — 버튼은 P4 이연

**현 코드에 delivered 전이 경로가 전혀 없음**(어드민 주문 변경 = `dispatchOrderAction`[paid→shipping]·`updateAdminNotesAction`만. delivered는 enum·트리거·필터·`describeStatus`에만 존재·도달 불가). DEC-P1(배송완료 후 적립) 구현 = 전이 자체 신설 필요.

- P2: **`complete_delivery` RPC(shipping→delivered 전이 + earn 인라인)**까지. RPC 직접 호출(SQL)로 검증.
- **`deliverOrder` 앱 서비스(computeEarnAmount → RPC) + 어드민 "배송완료" 버튼 = P4 이연.** 앱 글루를 P2에 두면 caller 없는 dead code(knip) → P4에서 버튼과 함께 추가. `complete_delivery`는 SQL 객체라 knip 무관, `computeEarnAmount`(P1)는 P4 caller 대기.

### Δ3. 적립 기준액 = `subtotal`(상품 소계·배송비/사용포인트 차감 안 함)

`pointService.computeEarnAmount(subtotal, policy)` 그대로. 1% 기준 farming(1000P 사용→10P 적립, 순 −990) 실익 0 → `subtotal − points_used` 차감 불요.

### Δ4. 범위 경계 — 정기배송/빌링 redeem 제외

빌링 경로(`process_billing_charge_success`)는 `orderService.createOrderFromInput`(pointsToUse 입력점)을 경유하지 않음 → 정기배송 결제의 **포인트 사용은 P2에서 자연 제외**. delivered 적립은 일반/정기 구분 없이 `subtotal` 기준 적용(per-type 적립 정책 = §12 carry·`enabled=false`라 영향 0).

### Δ5. `orders.points_used` 신규 컬럼

`discount_amount`(프로모용·현재 0) 재사용 대신 전용 컬럼(`integer not null default 0 check >=0`). `total_amount = subtotal + shipping_fee − discount_amount − points_used`. 기존 주문 default 0 → total 불변. create_order v2 가 `p_total_amount == subtotal+shipping−discount−points` 산술 일치 assertion 추가(머니 불변식 방어·Turbopack scope 버그 backstop).

### Δ6. ₩0 주문 엣지 (신규 제약 — P5/라이브)

`max_ratio=1.0`이면 포인트가 전액(`total_amount=0`)을 덮을 수 있으나 Toss는 ₩0 청구 불가. **P2 백엔드는 안전(clamp `>=0`·저장)만 보장**. 전액 포인트 차단(잔여 ≥ Toss 최소 결제액) 또는 ₩0 전용 플로우 = **P5(체크아웃 redeem UI)·라이브 정책 책임**으로 명시. `points.enabled=false`라 현재 미도달.

### P2 마이그·산출물

| 마이그 | 내용 |
|--------|------|
| **096** | `orders.points_used` 컬럼 + `create_order` v2(drop+recreate·`p_points_used` 인자·`FOR UPDATE` 잔액검증·`used` ledger·차감 원자·total assertion·권한 재부여) |
| **097** | 복원: `delete_pending_order` RPC 신설 + `sweep_stale_pending_orders`/`delete_stale_pending_orders` 복원 동반(037/038 직독 후 확정) |
| **098** | `complete_delivery` RPC(shipping→delivered 전이 + earn 인라인·멱등 `earn:`||order_id·member만) |

**앱 레이어(P2 실제 구현)**: `schemas/order`(pointsToUse 입력)·`pointService.resolveRedeem`(T1 경계·순수·테스트)·`pointRepo.getPointBalance`(서버 잔액조회)·`orderService`(잔액조회 → resolveRedeem 재계산 T1 → create_order v2 `pointsUsed`)·`orderRepo`(createOrder += pointsUsed·deletePendingOrderForUser → `delete_pending_order` RPC화). **`deliverOrder` 서비스 = P4 이연**(위 Δ2).

**검증**: 클라 위조 입력 캡(T1)·차감 원자·use/복원/적립 멱등·잔액 음수 차단·기존 결제/주문/구독 회귀 0(tsc/vitest/build).

---

## 14. S326 Phase 3 착수 패치 (환불 reversal · 코드 직독 재검증 결과)

> 착수 시 `apply_webhook_event`(021 최신 정의·012/013/021 전수 grep) · `payments`(012) · `reverse_points`/`point_ledger`(094/091) · 097(pending 복원) · paymentRepo(앱) 직독으로 §3 T6·§4·§6 환불 경로를 재검증한 결과. **이 섹션이 P3에 한해 §4~§6·§10을 보강·우선한다.**

### 핵심 결정 (사용자 승인)

- **DEC-S326-1 환불 시 사용 포인트 = 현금 환불 비율과 동일 비율 자동 복원**(전액·부분 모두 자동·어드민 수동 0). 사용자 요구 = "수동은 관리 리스크". 부분환불 전액복원(과복원)·수동(누락 리스크) 양쪽 기각.
  - 공식: `누적복원목표 = floor(points_used × 누적환불현금 / 승인현금)` · `이번복원 = 목표 − 기복원(refund 복원분 SUM)`. 전액환불 → 목표 = points_used 전액.
  - 어드민은 Toss 콘솔에서 **환불할 현금만 결정** → 시스템이 같은 비율로 포인트 자동 복원. P4 `adjust_points`는 예외 분쟁용으로만 잔존.

### 무결성 근거 (직독)

- **과복원 불가(수학적)**: 012 `payments CHECK(refunded_amount <= approved_amount)` → 누적환불 ≤ 승인현금 → `floor(P×R/A) ≤ P`. `least(P, …)` 이중 방어.
- **0 나눗셈 불가**: 012 `approved_amount CHECK(>0)` + payments found 확인. `approved<=0` guard 는 도달 불가 방어선(₩0 주문은 payments 행 자체 없음 → refund 분기 early return).
- **멱등(이중복원 차단)**: webhook replay → 021 `payment_transactions.idempotency_key UNIQUE` 23505 → 전체 롤백 → 복원 미실행(1차). `reverse_points` `'refundrestore:'||idem` on conflict(2차).
- **pending 복원 분리**: 기복원 SUM 은 `starts_with(idempotency_key,'refundrestore:')` 만 집계 → 097 pending 복원(`'restore:'`) 이중계산 차단. (paid+환불 주문 ≠ pending-cancel 주문 → 상태머신상 mutually exclusive · 접두 필터는 provable 방어.)
- **게스트/탈퇴**: `user_id is null`(게스트 DEC-P6·015 탈퇴 익명화 set null) 또는 `points_used=0` → 자연 skip.
- **적립분 회수**: DEC-P1(배송완료 후 적립)로 환불 대부분 미적립 → P3 범위 외. 배송완료 후 환불(드묾)의 적립 회수 = P4 어드민 adjust.

### Δ. 앱 변경 0

`paymentRepo.applyWebhookEventRpc` 가 5인자 그대로 호출 → `create or replace`(시그니처 불변)로 RPC 내부에서만 처리. webhookService/paymentRepo/테스트 무변경(tsc0·vitest891 유지). 기능 검증(적립→사용→환불 E2E)은 P5.

### P3 마이그·검증

| 마이그 | 내용 |
|--------|------|
| **099** | `apply_webhook_event` v2(021 본체 verbatim + refund_completed 분기에 비례 복원 블록 인라인·`reverse_points` 호출·`refundrestore:` 멱등키·grant 재선언) |

**검증(구조)**: 함수 1개·5인자 시그니처 불변·prosrc 에 `refundrestore:`/`reverse_points` 포함·service_role only. **검증(기능)**: 부분→전액 환불 시 비례·누적 복원·이중복원 차단 = P5 E2E(현 `enabled=false`·라이브 결제 전 미도달).

---

## 15. S327 Phase 4 (어드민 ①+③) 착수 패치 — 구매확정 모델 확정

> 코드 직독(032 settings 패턴·098 RPC·dispatch.ts·pointService) 재검증 + 사용자 합의로 적립 트리거 모델을 확정한다. **이 섹션이 P4·DEC-P1 의 "배송완료 적립 트리거"를 보강·우선한다.** S327 범위 = ①정책 UI + ③배송완료 override(앱 글루). ②수동가감·④정기배송 차등적립률은 차기.

### 핵심 결정 (사용자 승인)

- **DEC-S327-1 적립 트리거 = 구매확정(네이버 방식).** `delivered` = 적립 시점으로 매핑(098 `complete_delivery` 그대로 재사용). 트리거 3종이 모두 `deliverOrder(orderNumber)` SoT 호출:
  1. **구매자 "구매확정" 버튼**(프론트 P5 · 다음 세션)
  2. **자동확정 크론**(발송 + `auto_confirm_days` 경과 · 다음 세션)
  3. **운영자 override 버튼**(어드민 주문 상세 · S327 · 예외용)
  - 근거: 운영자 1건씩 수동 = 깜빡임 리스크("수동은 관리 리스크" 일관 선호). 구매확정은 **구매자가 수령·보유 의사 표명** → "적립 후 반품" 갭을 청약철회 기간 이후 자동확정으로 최소화.
- **DEC-S327-2 자동확정 N = 8일**(발송 기준 · 네이버 준용). 정책 `earn.auto_confirm_days`(Zod·기본 8·1~60). 청약철회(수령일+7일) 이후가 되도록. **JSONB+Zod라 마이그 불요.**
- **DEC-S327-3 override RBAC = owner-only**(`getAdminOwnerClaims`). 적립(금전) 발생 + 예외적 수동이라 정책·adjust_points 와 동급. 일상 경로(구매자·자동)는 staff 무관.

### 자동화 방식 리서치 결론 (carry — 다음 세션)

- **폴링(pull) 채택 · webhook 비권장.** GTR 규모선 webhook 도 `expirationTime` 24h 갱신 크론이 필요 → push 이점 상쇄. 폴링=움직이는 부품 1개(콜백 엔드포인트·보안 불요)·멱등 RPC로 재폴링 안전·적립은 시간 비민감.
- **provider = SweetTracker 조회 API**(carrier-agnostic·네이버/카카오 표준·`level 6`=배송완료·조회 무료 추정). 🔶 무료 한도·키 발급 확인 필요. 로젠 전용 API는 다른 택배사 발송건 누락이라 비권장(ShippingDialog 가 다중 택배사 허용).
- **단 구매확정 모델이면 v1 폴링 불필요**(발송+N 시간 기준 자동확정). SweetTracker 폴링 = 실배송완료 라벨·정확한 카운트다운 앵커용 **선택적 후속 강화**.

### S327 산출물 (앱 · 마이그 0)

| 파일 | 변경 |
|------|------|
| `lib/siteSettings.ts` | `PointsSettingsSchema.earn.auto_confirm_days`(기본 8) 추가 |
| `app/admin/(authed)/settings/{actions,SettingsForm}.tsx`·`_shared/helpers.ts` | `points` 저장 연결(owner-only 기존)·`equalPoints`·라벨 |
| `app/admin/(authed)/settings/sections/PointsSubForm.tsx` (신규) | 마스터/결제적립/행동적립/사용/만료 정책 편집 UI |
| `lib/admin/deliverOrder.ts` (신규 SoT) | order 조회 → computeEarnAmount → 098 complete_delivery(`earn:`||id 멱등). 트리거 3종 공유 |
| `app/admin/(authed)/orders/[orderNumber]/{actions,OrderDetailClient}.tsx` | `completeDeliveryAction`(owner-only) + shipping 출고영역 [배송완료] 버튼 + ConfirmModal |

**검증**: tsc 0 / vitest 891(변동 0) / build PASS. `enabled=false` → earn 0 → 전이만(회귀 0).

### 약관 (출시 게이트)

이용약관에 **제10조의3 (적립금)** 신설 필요(구매확정·자동확정 8일·구매확정 전 미적립·환불 시 회수권·만료·탈퇴 소멸·부정 회수). 현재 `enabled=false`라 **적립금 출시와 함께 시행일 갱신해 적용**(꺼진 기능 선노출 방지). 초안 = S327 complete 메모.

### 차기 (P4 잔여 + P5)

- **②수동가감**(`adjust_points` RPC·owner-only·audit) + **④정기배송 차등 적립률**(`earn.subscription_rates`·computeEarnForItems).
- **구매자 구매확정 버튼(P5) + 자동확정 크론**(발송+`auto_confirm_days`) — 한 쌍. + **earned 회수**(구매확정 후 환불 시·DEC-S326-1 적립분·현 미구현) 동반 권장.
- 선택: SweetTracker 폴링(실배송완료 정확도).

---

## 16. S328 Phase 4 잔여 (②수동가감 + ④정기배송 차등 적립률) 착수 패치

> 코드 직독(094 adjust_points·admin_audit 020/055/070·users 상세·042 빌링) 재검증. **이 섹션이 §7 어드민 ②·§12 정기배송 차등 적립률을 보강·우선한다.**

### 핵심 결정

- **DEC-S328-1 수동 가감 = owner-only + 이중 기록.** `adjust_points` RPC(094·service_role·±·멱등) 호출. **금액 권위 = point_ledger**('adjusted'·description=사유), **actor 책임 = admin_audit**(action 'adjust_points'·reason="±N P · 사유"). applied=true 일 때만 admin_audit insert(멱등 중복 시 audit 중복 방지). UI = 회원 상세(`/admin/users/[id]`) 적립금 카드(잔액+원장+가감 모달·client nonce 멱등키).
- **DEC-S328-2 정기배송 차등 적립률.** 정책 `earn.subscription_rates`(2주/4주/6주/8주·소수 0~1·기본 0.01·**JSONB+Zod 마이그 불요**). `computeEarnForItems(items, policy)`(품목별: 정기=cycle율·일반=earn.rate·line_total 기준 floor 합) 신설. **`deliverOrder`가 computeEarnAmount→computeEarnForItems 로 전환**(order_items fetch). `computeEarnAmount`(단일 금액)는 P5 UI 미리보기용 잔존.
  - **빌링 흐름 확인 결과(❓해소)**: 정기 첫 회차 = `create_order`(pending·order_items에 item_type='subscription'+subscription_period) → `process_billing_charge_success`(paid 전이). **일반 order로 생성 → dispatch→배송완료(deliverOrder) 동일 경유** → computeEarnForItems가 cycle율 자동 적용. **반복 회차 빌링 RPC(`process_billing_renewal` 등)는 미구현**(next_delivery_at 처리 크론 부재) → 구현 시 동일 order/deliverOrder 경유라 ④ 자동 호환.

### 산출물

| # | 파일 | 변경 |
|---|------|------|
| ② | 마이그 **100** | `admin_audit_action_check` 에 'adjust_points' 추가(070 패턴·드롭→재추가). **원격 적용 필요(선행 액션).** |
| ② | `pointRepo.ts` | `adjustPoints`(094 RPC·에러 매핑)·`getRecentPointLedger`(service_role·어드민 타 회원 원장) |
| ② | `usersServer.ts` | `fetchAdminUserDetail` += point_balance + pointLedger(N=20) |
| ② | `users/actions.ts` | `adjustPointsAction`(owner-only·Zod·멱등 nonce·adjust_points→admin_audit) |
| ② | `users/[id]/{page,UserDetailClient}.tsx` | 적립금 카드(잔액·원장·수동 가감 모달) |
| ② | `auditServer.ts`·`audit.ts` | AdminAuditAction += 'adjust_points'(/admin/audit 타임라인·라벨) |
| ④ | `siteSettings.ts` | `earn.subscription_rates`(2/4/6/8주) |
| ④ | `pointService.ts` | `computeEarnForItems` + `EarnLineItem`(7 테스트) |
| ④ | `deliverOrder.ts` | order_items fetch → computeEarnForItems |
| ④ | `PointsSubForm.tsx` | 정기 기간별 적립률 4입력 |

**검증**: tsc 0 / vitest 898(891+7) / build PASS. `enabled=false` → computeEarnForItems 0 / 가감은 enabled 무관(수동).

### 남은 작업

- P5: 구매자 구매확정 버튼 + 자동확정 크론 + earned 회수.
- 반복 회차 빌링(`process_billing_renewal` + next_delivery_at 크론) — 구현 시 ④ 자동 적용.
