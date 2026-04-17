# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 **잔여 작업** 을 추적한다.
> 완료 이력은 `docs/milestone-completed.md` 참조.
>
> **최종 업데이트:** 2026-04-17 · Backend P2-B Session 8 (보안 하드닝 #1~#3-4a · #4 + 통합 테스트 A/C/B) 완료 (`dcc55287`).

---

## 범례

| 기호 | 의미 |
|------|------|
| ✅ | 완료 |
| 🔄 | 진행 중 |
| ⬜ | 미착수 |
| ➖ | 해당 없음 / 스킵 |

---

## 전체 요약

| Phase | 완료 | 진행 중 | 미착수 | 진행률 |
|-------|------|---------|--------|--------|
| Phase 1 — Design | 5 | 0 | 0 | 100% |
| Phase 2 — Frontend | 1 | 2 | 0 | ~85% |
| Phase 3 — Backend | 2 | 1 | 0 | ~60% |
| Phase 4 — Infrastructure | 0 | 1 | 0 | ~20% |
| Phase 5 — QA | 0 | 0 | 3 | 0% |
| User AI | 0 | 0 | 1 | 0% |

**현재 위치:** Backend P2-B Session 8 완료. **다음: Session 11 — P2-D Resend 이메일 템플릿 + 보안 #3-4b (production `?orderNumber=` 차단).**

---

## 진행 중 · 잔여 작업

### Phase 2 — Frontend 🔄

#### 6. Frontend Development

| 항목 | 상태 | 비고 |
|------|------|------|
| 2-F 콘텐츠 채우기 | ⬜ | GoodDays / Story / MyPage — 검색 엔진/SRP 는 완료 |
| 2-G 반응형 + 프로덕션 | ⬜ | 4 브레이크포인트(360/768/1024/1440) + CSP·환경변수·빌드 최종화 |

#### 7. Content & Asset

| 항목 | 상태 | 비고 |
|------|------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | 프로토타입 내 일부 WebP · 본격 파이프라인 미구축 |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | Supabase 스키마 확정 후 설계 |

#### 프로덕션 전 필수 처리

| ID | 이슈 | 처리 시점 |
|----|------|-----------|
| H3 | 사업자 정보 소스코드 하드코딩 → 환경변수/DB 이관 | Phase 2-G |
| M7 | CSP 등 보안 응답 헤더 최종 점검 → `next.config.ts headers()` | Phase 2-G |

#### 코드 리뷰 잔여

| 순서 | 대상 | 상태 |
|------|------|------|
| R-5 | 2-E 플로우 복구 + `/biz-inquiry` | ⬜ (RP 재이식 이후 필요 시) |
| R-7 | 2-G 반응형 + 프로덕션 | ⬜ |
| RP-11 | 반응형 4BP + 프로덕션(CSP·env·빌드) | ⬜ |

---

### Phase 3 — Backend 🔄

> 계획 문서: `docs/backend-architecture-plan.md` · `docs/payments-flow.md` · `docs/payments-security-hardening.md`

#### 세션 로드맵 (P2-B/D/E/F/G/H · 현재 Session 8 완료)

| 세션 | 범위 | 상태 |
|------|------|------|
| Session 3~6 | P2-B B-1 ~ B-4 + 리뷰 Pass 1 | ✅ |
| Session 7 | B-5 정산 RPC + Resend 인프라 + Pass 1 A안 | ✅ |
| Session 8 | 결제 보안 하드닝 #1~#4 + 통합 테스트 A/C/B | ✅ |
| **Session 11** | **P2-D Resend 이메일 템플릿 + 보안 #3-4b (prod `?orderNumber=` 차단)** | **⬜ (다음)** |
| Session 12+ | P2-F RLS / RBAC | ⬜ |
| Session 13+ | P2-G 프로덕션 / P2-H 인프라 | ⬜ |
| 차후 | P2-C 정기배송 엔진 | ⬜ (정책 확정 대기) |

> 세부 세션별 범위는 `memory/project_backend_p2_session_plan.md` 참조.

#### Session 11 스코프 (P2-D + #3-4b)

| # | 항목 | 비고 |
|---|------|------|
| 1 | `orderConfirmationEmail` 에 `/order-complete?token={public_token}` CTA | 템플릿에 `publicToken` prop 추가 |
| 2 | `shippingNotificationEmail` CTA 링크도 token 기반 | 동일 |
| 3 | `sendOrderConfirmationEmail` / `sendShippingNotificationEmail` 시그니처 확장 | `publicToken` 주입 경로 |
| 4 | `ConfirmResult.publicToken` 노출 + `confirm/route.ts` 전달 | repo 에 token 이미 존재 |
| 5 | 보안 #3-4b — `/order-complete/page.tsx` 에서 `?orderNumber=` 차단 (`NODE_ENV === 'production'` 한정 404) | dev/staging 유지 |
| 6 | 통합 테스트 — 템플릿 렌더링 + 링크 포맷 검증 | 회귀 방어 |
| 7 | welcome email — OAuth 콜백(kakao/naver/google) 연동 | 별도 세션 가능 |

#### Auth & Security 잔여

| 항목 | 상태 | 비고 |
|------|------|------|
| P2-2 Supabase RLS 정책 (앱 레벨) | ⬜ | P0 에서 6개 테이블 + 정책 11개 선적용 완료. `cart_items` 등 앱 레벨 확장은 Session 12+ |
| RBAC / 인가 정책 | ⬜ | admin/customer 역할 분리 (Session 12+) |
| 최종 보안 감사 | ⬜ | P2-2 완료 후 security-reviewer 전면 감사 |

#### Payment & Order 잔여

| 항목 | 상태 | 비고 |
|------|------|------|
| 정기배송 구독 엔진 | ⬜ | 정책 확정 대기 (Session 차후) |

---

### Phase 4 — Infrastructure 🔄

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프로젝트 설정 | ⬜ | Next.js 프로젝트 생성 후 연결 |
| Supabase 프로젝트 설정 | 🔄 | dev(`ceqewbbjuhtnarzgkzmx`) 완료 · staging/prod 분리 남음 |
| CI/CD 파이프라인 | ⬜ | Vercel 자동 배포 |
| 모니터링 / 에러 트래킹 | ⬜ | Sentry · Vercel Analytics |

---

### Phase 5 — Quality Assurance ⬜

> 개발 완료 후 일괄 실시.

| 그룹 | 항목 | 비고 |
|------|------|------|
| 12. Accessibility | WCAG 2.1 AA 자동 검수 + 수정 | — |
| 13. Performance & SEO | Core Web Vitals · 번들 최적화 · 메타·구조화데이터 | 배포 후 측정 |
| 14. Testing & QA | 크로스 브라우저 + 시각 회귀 + E2E(Playwright) | — |

---

### User AI ⬜

| 항목 | 상태 | 비고 |
|------|------|------|
| AI 페르소나 시뮬레이션 | ⬜ | 리서치 페르소나 기반 대화 검증 |
| 유저 클론 검증 | ➖ | 실제 유저 데이터 필요 (서비스 출시 후) |

---

## 참고 문서

| 문서 | 용도 |
|------|------|
| `docs/milestone-completed.md` | 완료 이력 아카이브 |
| `docs/backend-architecture-plan.md` | 14주 백엔드 로드맵 + 모델 선택 가이드 |
| `docs/payments-flow.md` | 결제 플로우 스펙 (v1.0.7) |
| `docs/payments-security-hardening.md` | Session 8 보안 #1~#4 스펙 + 4b 이행 계획 |
| `docs/email-infrastructure.md` | Resend 인프라 + 템플릿 설계 |
| `docs/settlement-report.md` | Session 7 정산 RPC 스펙 |
| `docs/adr/ADR-001-oauth-account-merge-policy.md` | OAuth 계정 병합 정책 |
| `docs/adr/ADR-002-payment-webhook-verification.md` | 결제 웹훅 하이브리드 인증 |
| `docs/security-research-2026-04-16.md` | Session 6 폴리시 — 업계 표준 리서치 근거 |
| `memory/project_backend_p2_session_plan.md` | 세션별 모델·에이전트 계획 |
