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

## 8. 프론트엔드

- **잔액 표시**: 마이페이지·헤더(선택). `getBalance`
- **체크아웃 사용**: 보유 포인트 내 사용 입력 + 실시간 차감 미리보기(`previewRedeem`). 서버 재계산이 최종 권위(클라 표시는 UX용)
- **마이페이지 내역**: 적립/사용/만료 이력(ledger). 적립 예정(pending) 표시

---

## 9. 멱등·동시성·회계 무결성

- **멱등**: 적립=order_id 기반 key·사용=order 기반·재시도 안전(결제 3중 멱등 답습)
- **동시성**: 잔액 변경 RPC는 `SELECT ... FOR UPDATE`(동시 결제 race 차단)
- **회계**: `SUM(point_ledger.amount) == profiles.point_balance` 불변식. reconciliation 쿼리(정기) + 트리거 보장. 포인트 부채(미사용 발행액) 정산 리포트

---

## 10. 구현 Phase (제안)

| Phase | 범위 | 검증 |
|-------|------|------|
| P1 | 스키마(090~096) + `pointService`(순수 로직) | RPC 멱등·잔액 음수 차단·RLS 차단 단위/통합 |
| P2 | `orderService` 사용 통합 + 배송완료 적립 훅 | 사용액 서버 재계산·잔액 검증·적립 idempotency |
| P3 | 환불 reversal(097) | 사용분 복원·이중복원 차단 |
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
- 적립 예정(pending) 노출 방식
- 토스 라이브 키 없이 테스트 가능 범위(포인트 로직 자체는 결제와 분리 테스트 가능)
