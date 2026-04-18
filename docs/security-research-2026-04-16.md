# 결제·보안 오버엔지니어링 재검토 — 리서치 기반 통합 종합

> **작성일:** 2026-04-16 (리서치) · 2026-04-17 (최종 결정 적용)
> **계기:** Backend P2-B Session 6 B-7 4-병렬 리뷰 Pass 1 에서 수용한 security 권고(H-1/H-3/M-3) 가 **Toss 공식 문서 / 국내 커머스 업계 표준 / OWASP 위협 모델** 3각에서 실제로 필요한 방어인지 재검증한다.
> **계기 질문 (사용자):** "대부분의 비회원 구매를 허용하는 커머스들이 사용하고 있는 방법이 있지 않을까? 국내에서 토스 페이먼트를 사용중인 다른 커머스들의 사용 예를 리서치는 미리 해본거야? 우리가 보안을 신경써서 구현하고 있는 것은 맞지만, 지금 너무 오버해서 우리만의 뭔가 너무 특별한 것을 만들고 있는 것은 아닌가."
> **결론:** 우리 설계는 전반적으로 OWASP 권고와 일치하지만, **H-3(IP allowlist)** 는 기각, **H-1(guest_email 교차검증)** 은 프레이밍 재조정(UX 폴백 추가), **M-3(approved_at throw)** 는 단순화.

---

## 1. 리서치 방법

3-parallel agent 로 독립 조사:

| Agent | 초점 | 산출 |
|---|---|---|
| A | Toss 공식 문서 · Toss SDK 레퍼런스 · Toss Developer Center 게시물 | 서명 정책 · IP 공개 여부 · 웹훅 인증 표준 |
| B | 국내 Toss 사용 커머스 (OSS 레포 · 기술 블로그) 실제 구현 패턴 | guest checkout 소유권 검증 · 웹훅 인증 구현체 |
| C | OWASP Webhook Security Cheat Sheet · Stripe Webhooks 문서 · PCI DSS 4.0 · OWASP API Security Top 10 | 표준 위협 모델 · 공격 비용/이득 |

동일 질문 3개:
1. Session 6 에서 수용한 H-1/H-3/M-3 권고가 업계 표준에 부합하는가?
2. 우리가 추가한 방어층이 토스 공식 또는 주요 커머스 구현에서 관찰되는가?
3. 기각해야 할 오버엔지니어링이 있다면 어떤 근거로?

---

## 2. 항목별 결론 및 근거

### 2.1 H-1 — 게스트 주문 `guest_email` 교차검증

**원래 권고(Session 6 B-7):** confirm API 가 `body.guestEmail` 과 `orders.guest_email` 을 교차검증해 "게스트 주문의 paymentKey 탈취 시 제3자 승인을 막는다"는 프레이밍으로 채택.

**재평가 결론:** **유지하되 프레이밍 재조정 + UX 폴백 신설.**

**근거 요약:**

| 출처 | 관찰 |
|---|---|
| Research A (Toss 공식) | Toss 는 가맹점에 guest 식별자 교차검증을 요구하지 않음. `paymentKey` 의 unguessability + `amount` 교차검증이 1차 방어. guest 고유 식별자 비교는 "가맹점 재량 추가 방어" 로 분류. |
| Research B (국내 커머스) | 조사된 국내 OSS/레퍼런스 구현 중 guest checkout 시 이메일 교차검증을 명시적으로 수행하는 사례는 소수. 대부분 `orderId` + Toss 서버 응답의 일치만 확인. |
| Research C (OWASP) | API Security Top 10 2023 의 "Broken Object Level Authorization (BOLA)" 범주에 해당. 게스트 주문은 소유권이 session 에 없으므로 별도 토큰(이메일·주문번호·단기 서명) 비교가 필요. |

**실제 방어 대상:**
- MitM 은 이미 TLS 가 방어 → H-1 으로 막을 위협이 아님.
- 남는 위협은 "체크아웃 완료 후 successUrl 이 레퍼러 헤더로 유출되거나 30초 내 공유 링크로 노출되어 제3자가 `/order-complete?paymentKey=...&orderId=...&amount=...` 재진입" 하는 극소 윈도우.
- 이 윈도우에서 서버가 `guestEmail` 을 추가 요구하면, 제3자는 이메일을 모르므로 승인 불가.

**결정:**
1. 방어층 자체는 **유지** (저비용 · 저위험 · 실제 방어 대상은 좁지만 제거할 필요도 없음).
2. 주석·문서 프레이밍을 "MitM 방어" → "레퍼러 누출·공유 링크 노출 방어" 로 정정 (`paymentService.assertOwnership` 주석 · `payments-flow.md §6.7`).
3. **신설:** UX 폴백 — `forbidden.guest_email_mismatch` 수신 시 OrderCompletePage 가 **에러 페이지 대신 이메일 재입력 프롬프트** 를 렌더. 3회 실패 시 주문조회 분기 (`payments-flow.md §6.8`). 사용자가 체크아웃에서 typo 한 경우가 악의적 공격보다 훨씬 흔하다는 전제.

### 2.2 H-3 — Toss 웹훅 IP allowlist 추가 제안

**원래 권고(Session 6 B-7):** ADR-002 하이브리드 인증에 더해 Toss 공식 발신 IP CIDR 를 고객센터에 문의해 수령 후 allowlist 적용.

**재평가 결론:** **기각 (Reject).**

**근거:**

| 출처 | 관찰 |
|---|---|
| Research A (Toss 공식) | 공개 문서(`docs.tosspayments.com/guides/v2/webhooks`)에 "고정 IP 를 사용한다" 언급만 있고 **실제 CIDR 은 미공개**. 고객센터 회신의 정확성·변경 공지 채널도 불투명. |
| Research B (국내 커머스) | Toss 사용 커머스 레퍼런스 중 IP allowlist 단독 또는 주요 방어로 언급하는 구현은 발견되지 않음. 서명/GET 재조회 계열이 표준. |
| Research C (OWASP) | Webhook Security Cheat Sheet 는 "IP allowlist 는 **서명이 없을 때의 보완책**" 로 정의. 서명 또는 그에 상응하는 권위 검증이 있으면 중복 방어. |

**논거:**
- 본 ADR-002 는 이미 수단별 하이브리드 인증을 확립 — 카드 `PAYMENT_STATUS_CHANGED` 는 Toss API `GET /v1/payments/{paymentKey}` 권위 재조회로 페이로드를 교차검증하고, 가상계좌 `DEPOSIT_CALLBACK` 은 per-payment `webhook_secret` 을 `timingSafeEqual` 로 비교.
- 이 둘은 Stripe 의 `Stripe-Signature` 서명 검증과 **기능적으로 동등한 역할** — "이 요청이 진짜 Toss 가 보냈는가" 를 확인하는 수단.
- 따라서 IP allowlist 는 중복 방어이고, Toss IP 변경 시 유지보수 비용만 증가.
- 관측 로깅(`payment_events.raw_payload` 의 `x-forwarded-for` 포함) 은 유지 — 사후 이상 패턴 탐지 보조.

**결정:**
1. **IP allowlist 구현 계획 삭제** — `docs/toss-support-inquiry.md` 의 IP CIDR 문의 섹션 제거, §0 상태 공지 추가.
2. **ADR-002 §4.3 "거부된 대안"** 에 "IP 화이트리스트 *보완* 방어 (Session 6 제안)" 행 추가 — 기각 근거 4개 명시.
3. **고객센터 문의는 계속 필요** — 서명 헤더 존재 여부·재시도 정책·User-Agent·이벤트 타입 목록 확인용. 문의 1 제거, 2/3/4 유지.

### 2.3 M-3 — `approvedAt` 누락 시 throw

**원래 권고(Session 6 B-7):** `paymentService.deriveRpcParams` 가 `tossResponse.approvedAt` 미존재 시 서버 now() fallback 대신 `toss_failed('approved_at_missing')` 로 즉시 실패. 이유: "감사 불가능한 서버 시각 삽입을 금지해 감사 정확도 확보".

**재평가 결론:** **단순화 — fallback + warn + `_fallback` 플래그.**

**근거:**

| 관점 | 관찰 |
|---|---|
| 실발생 빈도 | Toss 공식 응답 스펙상 `DONE` 상태에서 `approvedAt` 누락은 사실상 0% 에 가까움. |
| 오탐 비용 | 정당한 결제(고객 돈이 이미 빠져나감) 를 우리 쪽 "감사 정확도" 사유로 실패 반환하면 CS 폭증 + 사용자 피해. |
| 감사 추적성 | 서버 now() 대체 시 `rawResponse._fallback.approved_at=true` 플래그와 `console.warn` 로그로 **사후 식별 가능** — 감사 정확도를 버리는 것이 아니라 신호 전환. |

**결정:**
1. `deriveRpcParams` 가 `approvedAtFallback: boolean` 을 함께 반환.
2. 누락 시 `new Date().toISOString()` 로 대체 + `console.warn` 로그(orderId/paymentKey/fallbackApprovedAt 포함).
3. 호출부 `confirmOrder` 가 `maskedResponse` 에 `{ _fallback: { approved_at: true } }` 를 merge 후 RPC 전달 → `payment_transactions.raw_payload` 에 보존.

### 2.4 그 외 — 유지 결정

| 항목 | 결론 | 이유 |
|---|---|---|
| C-3 rawPayload 마스킹 (Toss 카드번호·가상계좌번호·이메일 등) | **유지 AS-IS** | PCI DSS 4.0 Req 3.4.1 (PAN 마스킹) 법적 요구. Toss 가 이미 마스킹해 내려주지만 `payment_transactions.raw_payload` 재가공 파이프라인 추가 시 안전망 필수. |
| ADR-002 하이브리드 웹훅 인증 (GET 재조회 + timing-safe secret) | **유지 AS-IS** | Research A/B/C 모두 동의. Stripe 권고 패턴과 동등. |
| confirm 3중 멱등 방어 (app pre-check / RPC FOR UPDATE / UNIQUE) | **유지 AS-IS** | Toss 가 공식 `Idempotency-Key` 미지원 전제에서 정당. v1.0.6 블로커 #1 해결. |

---

## 3. 새로 식별된 위협 (이번 세션 범위 밖 — 향후 처리)

Research C 가 추가로 제기한 것들. Session 6 폴리시에는 포함하지 않고 별도 세션으로 분리.

| 항목 | 심각도 | 처리 시점 | 비고 |
|---|---|---|---|
| 체크아웃 엔드포인트 rate limit (carding 공격 대응) | HIGH | Session 7 또는 B-6 이전 | Magento #28614 사례. `POST /api/orders` 에 IP 기준 rate limit. |
| `Referrer-Policy` 헤더 (successUrl 유출 경로 차단) | MEDIUM | Phase 2-G | `next.config.ts` 헤더 설정 또는 `middleware.ts`. 값: `strict-origin-when-cross-origin` 또는 `same-origin`. |
| `orders.order_number` enumeration 가능성 | MEDIUM | Phase 2-G 또는 3 | 현재 `GT-YYYYMMDD-NNNNN` 순차. 공격자가 하루치 주문번호 범위를 추측 가능. UUID/nanoid 로 내부 PK 분리, 표시용 order_number 만 순차 유지 또는 전환. |
| PCI DSS 로그 보존 정책 문서화 | MEDIUM | Phase 2-G | `payment_transactions` / `payment_events` 보관 기간 + 접근 통제 + 삭제 절차. Req 10 대응. |

이 네 항목은 **본 연구의 부산물**이며, Session 6 리서치 결정과는 별개 작업으로 관리한다.

---

## 4. 교훈 (Session 6 이전 패턴 검토 결과)

Past session 검토 (Explore agent 결과) 에서 비슷한 "이론적 방어를 문서화된 ADR 로 정당화" 사례가 4건 발견됨:

1. **ADR-001 §6.4 Google PKCE 비대칭** — Google 만 "세션 수립 후 역검증 + signOut" 강제. 기술 제약 vs 실제 방어 가치 trade-off 분석 부족.
2. **ADR-002 §3.1 카드 GET 재조회** — "secret 이 없으니 위조 가능" 논리는 타당하나 실제 위협 모델(공격자가 paymentKey 획득 경로) 이 불명확.
3. **oauth-security-plan §P1-1 Naver 내부 이메일** — OAuth 제공자 신뢰도 계층이 Naver 공식 재검증 없이 수용.
4. **backend-architecture-plan §3.3 RLS `status='pending'` 강제** — `create_order` RPC 단일 경로가 이미 차단하므로 같은 기능 이중화.

모두 문서화돼 있어 즉시 수정 필요는 없으나, **향후 스프린트에서 "외부 리서치 링크 · 위협 모델 수치 · 비용/이득 매트릭스" 를 추가 보완**한다.

전역 규칙화:
- `memory/feedback_industry_standard_research.md` 신설 — "리뷰 권고 기계 수용 금지. 공식 문서 → 업계 실구현 → OWASP 위협 모델 3각 리서치 → 수용/기각 결정".

---

## 5. 실행 체크리스트 (2026-04-17)

- [x] `paymentService.ts` — M-3 단순화 + H-1 주석 프레이밍 보정
- [x] `OrderCompletePage.tsx` — H-1 폴백 UX (재입력 프롬프트 + 3회 한도)
- [x] `payments-flow.md` §6.7/6.8 신설 + §9 변경 이력 v1.0.8
- [x] `toss-support-inquiry.md` IP 문의 섹션 제거 + §0 상태 공지
- [x] `ADR-002 §4.3` IP 보완 방어 기각 행 추가
- [x] `docs/security-research-2026-04-16.md` (본 문서) 작성
- [ ] `milestone.md` Session 6 폴리시 반영
- [ ] `memory/project_backend_p2b_session7_entry.md` 업데이트
- [ ] 검증: `pnpm tsc --noEmit` · `pnpm eslint` · `pnpm vitest` (195/195 유지)
- [ ] 단일 커밋 번들

---

## 6. References

- Toss 공식 · Webhooks: https://docs.tosspayments.com/guides/v2/webhooks
- Toss 공식 · Payment API: https://docs.tosspayments.com/reference#payment
- OWASP · Webhook Security Cheat Sheet
- OWASP · API Security Top 10 2023 — API1:2023 Broken Object Level Authorization
- PCI DSS 4.0 — Req 3.4.1 (PAN 마스킹), Req 10 (로그 보존)
- Stripe · Webhooks — https://stripe.com/docs/webhooks/signatures
- Magento Security Advisory #28614 (carding attack on checkout)
- context7 `/llmstxt/tosspayments_llms_txt` (2026-04-16 조회)
