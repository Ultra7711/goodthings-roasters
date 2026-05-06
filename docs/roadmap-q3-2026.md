# GTR 로드맵 Q3 2026 — 출시 전 통합 계획

> **목적:** S173 시점에서 출시까지 남은 작업 전체를 한눈에 보고 의존성·우선순위를 정리한다.
> **작성:** 2026-05-07 (S173 종료 시점)
> **참조:** docs/milestone.md (현재 Phase 추적), docs/adr/ADR-008-toss-billing-integration.md

---

## 1. 현황 스냅샷

### 1.1 직전까지 완료된 큰 영역

- ✅ Phase 1 (인프라·디자인 시스템·홈·PDP·카트·체크아웃 일반결제 기본)
- ✅ Phase 2 백엔드 (auth·orders·payments·webhook·정기배송 첫 회차)
- ✅ S147~S148 시그니처 chapter (advisory PR-1c/PR-2)
- ✅ S161~S169 Architecture Deepening (Candidate 2 PR-1, 6, 7)
- ✅ S170~S173 Checkout 리팩터 + pending order 정합성 + abandoned DELETE 정책
- ✅ Typography·Grid sprint PR-1~7 (S140~S145)

### 1.2 최대 미해결 — 정기배송 자동결제

> **현재 정기배송은 첫 회차 결제만 작동.** 다음 배송일이 도래해도 자동결제·발송 로직이 0.

→ **Phase 3 토스 빌링 통합** 필수 (ADR-008). Q3 출시 전 가장 큰 작업.

---

## 2. 미해결 작업 카탈로그

### 2.1 카테고리 분류

| 카테고리 | 항목 수 | 총 추정 sprint |
|----------|--------|---------------|
| Phase 3 토스 빌링 통합 (ADR-008) | 5 sub-phase | 5~7 sprint |
| Architecture Deepening 잔여 candidates | 4 | 3~5 sprint |
| Checkout/UX carry-over | 4 | 1~2 sprint |
| Admin 잔여 / DB 운영 | 3 | 2 sprint |
| Typography·디자인 잔여 | 2 | 1 sprint |
| Pre-production 체크리스트 | 1 | 0.5 sprint |
| Phase 5 QA (출시 직전) | 3 | 1~2 sprint |
| **합계** | **22** | **13~19 sprint** |

### 2.2 영역별 상세

#### A. Phase 3 토스 빌링 통합 (ADR-008)

**우선순위: 🔴 최상 (출시 blocker)**

| Sub-phase | 범위 | 추정 |
|-----------|------|------|
| **3-A 인프라** | DB schema (billing_methods + customer_key + 026 RPC 수정) + 백엔드 API + 토스 빌링 클라이언트 | 1~2 sprint |
| **3-B 클라이언트 UI** | CheckoutPayment 분기 + /billing/success 콜백 + MyPage 카드 관리 | 1 sprint |
| **3-C 자동 cron** | pg_cron run_subscription_billing + 결제 실행 + next_delivery_at 갱신 | 1 sprint |
| **3-D 실패 처리** | 재시도 정책 + 카드 만료 알림 + 빌링 실패 메일 + admin 모니터링 | 1~2 sprint |
| **3-E 운영 전환** | 토스 심사 + 라이브 키 교체 + 테스트 데이터 truncate | 0.5 sprint |

**선결 조건:** 클라이언트 컨펌 + 토스 비즈센터 빌링 심사 신청.

**흡수 항목:**
- 026 RPC subscription INSERT 시점 변경 → Phase 3-A 흡수
- payment_method.transfer enum deprecation → 정기배송 결제수단 정책 명시되면 자연 정리
- 정기배송 사후 환불/skip 기능 (`project_subscription_admin_skip_refund.md`) → Phase 3-D 일부
- ADR-005 subscription cycles lookup → 별도 sprint (운영자 편집 가능 cycle 테이블)

#### B. Architecture Deepening 잔여

**우선순위: 🟡 출시 가능 여부와 직접 무관, 유지보수성 ↑**

| Candidate | 범위 | 상태 | 추정 |
|-----------|------|------|------|
| **Candidate 2 PR-2/3** | MyPagePage god component 추가 분해 (S161 PR-1 후속) | 🔄 부분 완료 | 1~2 sprint |
| **Candidate 1** | globals.css 분할 (현재 8000+ 줄) | ⬜ pending | 1 sprint, 회귀 risk 🟠 |
| **Candidate 4** | 상품 DB 전환 (현재 하드코딩) | ⬜ pending, **출시 blocker 가능성** | 큰 sprint |
| **Candidate 8** | CSP nonce/SRI 분기 (ADR-007 신설 carry-over) | ⬜ pending | 0.5~1 sprint |

**Candidate 4 (상품 DB 전환)** = Phase 3과 함께 가장 큰 carry-over. 정기배송 cycle 결제 시 상품 가격을 어디서 조회할지 결정과 직결.

#### C. Checkout / UX Carry-over

**우선순위: 🟡 (출시 시 필요한 UX 완성)**

| 항목 | 메모 | 추정 |
|------|------|------|
| 로그인 복귀 주소 pre-fill | `project_checkout_address_prefill.md` | 0.5 sprint |
| Daum Postcode 더미 데이터 → 실 API 전환 | `project_checkout_dummy_address.md` | 0.5 sprint |
| 결제 위젯 후속 (CTA 디자인 + 무한대기 버그) | `project_checkout_payment_ui_followup.md` | 0.5 sprint |
| Shop 카드 빠른 옵션 선택 (UX 강화) | `project_shop_card_quick_select.md` | 0.5~1 sprint |

#### D. Admin / DB 운영

**우선순위: 🟡**

| 항목 | 메모 | 추정 |
|------|------|------|
| Good Days 어드민 편집 | `project_gooddays_admin_edit.md` | 1 sprint |
| 시즌 배너 다중 등록·날짜 자동 교체 | `project_season_banner_schedule.md` | 0.5 sprint |
| 검색 동의어 DB 이관 + admin | `project_search_synonym_backend.md` | 0.5 sprint |

#### E. Typography / 디자인 잔여

**우선순위: 🟢 점진 개선**

| 항목 | 메모 | 추정 |
|------|------|------|
| 메인 §2.3~§2.7 + PDP/마이페이지/카트 advisory 잔여 | milestone.md Phase 3 표 | 1 sprint |
| Typography sub-pixel 잔여 PR (S145 이후 audit) | `project_typography_subpixel_8px_grid.md` | 0~0.5 sprint |

#### F. Pre-production 체크리스트

**우선순위: 🔴 출시 blocker**

`project_pre_production_checklist.md` — 코드 리뷰 3명 교차 검증 도출 (H3·M7 일부 완료, 잔여 점검 필요)

| 영역 | 추정 |
|------|------|
| 잔여 H/M 항목 점검 + 처리 | 0.5 sprint |
| 결제 사용자 가이드 문서 (`project_payment_user_guide_needed.md`) | 0.5 sprint |
| Footer 법적 정보 (`project_footer_legal_requirements.md`) | 0.5 sprint |
| 상품 이미지 데이터 구조 정합 (`project_product_image_data.md`) | 0.5 sprint, Candidate 4와 결합 가능 |

#### G. Phase 5 QA (출시 직전)

**우선순위: 🔴 출시 직전 일괄**

| 그룹 | 항목 | 추정 |
|------|------|------|
| 12 Accessibility | WCAG 2.1 AA 자동 검수 + 수정 | 0.5 sprint |
| 13 Performance & SEO | Core Web Vitals + 메타·구조화데이터 | 0.5 sprint |
| 14 Testing & QA | 크로스 브라우저 + 시각 회귀 + Playwright E2E | 1 sprint |

---

## 3. 의존성 매트릭스

```
┌─────────────────────────────────────────────────────────┐
│ 클라이언트 컨펌 (운영) ─┐                              │
│                         ├─> Phase 3-A 인프라           │
│ ADR-008 승인 ───────────┘    └─> Phase 3-B UI          │
│                                  └─> Phase 3-C cron     │
│                                      └─> Phase 3-D 실패 │
│                                          └─> Phase 3-E  │
│                                                          │
│ Candidate 4 (상품 DB) ──> Phase 3 cycle 결제 가격 조회 │
│                       ──> Pre-production 상품 이미지   │
│                                                          │
│ Pre-production 체크리스트 ─> 출시                       │
│                                                          │
│ Phase 5 QA ──> 출시 직전 (Phase 3 완료 후)             │
└─────────────────────────────────────────────────────────┘

병렬 가능 (의존성 없음):
- Architecture Candidate 1, 2-PR2/3, 8
- Checkout/UX carry-over
- Admin/DB 운영
- Typography/디자인 잔여
```

---

## 4. 권장 실행 순서

### Track 1 — 출시 Critical Path (직렬)

1. **클라이언트 컨펌 받기** (ADR-008 D-1)
2. **Phase 3-A 인프라** (1~2 sprint)
3. **Phase 3-B 클라이언트 UI** (1 sprint)
4. **Phase 3-C 자동 cron** (1 sprint)
5. **Phase 3-D 실패 처리** (1~2 sprint)
6. **Candidate 4 상품 DB 전환** (큰 sprint, Phase 3와 병행 가능 시점부터)
7. **Pre-production 체크리스트 마무리** (0.5 sprint)
8. **Phase 5 QA** (1~2 sprint)
9. **Phase 3-E 운영 전환** (0.5 sprint)

→ **추정 총합 7~10 sprint** (병렬 효율 가정)

### Track 2 — 병렬 가능 작업

Phase 3 진행 중 다음 영역을 별 세션에서 병행:

- Checkout/UX carry-over (1~2 sprint)
- Admin/DB 운영 (2 sprint)
- Architecture Candidate 1, 2-PR2/3, 8 (3~5 sprint)
- Typography 잔여 (0~1 sprint)

### Track 3 — Phase 3 완료 후

- 정기배송 운영 메뉴얼 작성 (admin SOP)
- ADR-005 subscription cycles lookup table

---

## 5. 마이그레이션 번호 예약

Phase 3 빌링 통합 마이그레이션 번호 사전 예약:

| 번호 | 내용 |
|------|------|
| 040 | profiles.customer_key + billing_methods + subscriptions.billing_method_id + subscription_billing_failures |
| 041 | 기존 active subscription truncate (D-4) |
| 042 | 026 RPC 수정 (subscription INSERT 제거 + 사전 검증) |
| 043 | pg_cron run_subscription_billing |

추가 마이그레이션이 필요하면 044+ 사용.

---

## 6. 결정 필요 / Open Questions

세션 진입 시 명시적 결정 받아야 할 항목:

| ID | 결정 사항 | 결정 시점 |
|----|----------|-----------|
| Q-1 | Phase 3-A 시작 시점 (클라이언트 컨펌 받았는지) | Phase 3-A 진입 전 |
| Q-2 | Candidate 4 (상품 DB 전환)을 Phase 3와 병행할지 직렬할지 | Phase 3-A 종료 직후 |
| Q-3 | 출시 목표 일자 (Phase 5 QA 분량 결정) | 출시 2 sprint 전 |
| Q-4 | 게스트 정기배송 차단 시 카트 UX (회원 강제 모달 vs 카트에 못 담게) | Phase 3-B 진입 전 |
| Q-5 | ADR-007 CSP nonce/SRI 작업을 출시 전 처리할지 후 처리할지 | Track 2 일정 결정 시 |

---

## 7. 추적 / 갱신

- 각 sub-phase 완료 시 `project_session{N}_complete.md` 작성 + 본 문서 상태 업데이트
- 새 carry-over 발생 시 본 문서 §2 카탈로그에 즉시 추가
- 의존성 변경 시 §3 매트릭스 갱신

---

## 8. 참조 인덱스

**ADR**
- ADR-001 OAuth 계정 병합 정책
- ADR-002 결제 webhook 검증
- ADR-003 RBAC 역할 분리
- ADR-004 상태관리 단순화
- ADR-005 (예약) Subscription cycles lookup
- ADR-006 Admin pages ↔ API 분리
- ADR-007 (예약) CSP nonce/SRI
- **ADR-008 토스 빌링 통합 (이번)**

**계획 문서**
- docs/milestone.md — 현재 Phase 진행 추적
- docs/admin-implementation-plan.md — 어드민 풀 구축 (대부분 완료)
- docs/subscription-full-implementation-plan.md — 정기배송 풀 구현 (Phase 3에서 재해석)
- docs/backend-architecture-plan.md — 14주 백엔드 로드맵

**메모리 인덱스**
- memory/MEMORY.md
- memory/NEXT_SESSION.md (다음 세션 진입 가이드)
