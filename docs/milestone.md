# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 **잔여 작업** 을 추적한다.
> 완료 이력은 `docs/milestone-completed.md` 참조.
>
> **최종 업데이트:** 2026-04-22 · Session 54 — 검색결과·카페하이라이트·드로어 모바일 폴리시 버그 수정 (BUG-109·110) + 검색 모바일 UX(간격·헤어라인·페이지네이션).

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
| Phase 2 — Frontend | 3 | 1 | 0 | ~95% |
| Phase 3 — Backend | 2 | 1 | 0 | ~55% |
| Phase 4 — Infrastructure | 3 | 1 | 0 | ~80% |
| Phase 5 — QA | 0 | 0 | 3 | 0% |
| User AI | 0 | 0 | 1 | 0% |

**현재 위치:** Sessions 18~49 (디자인 폴리시 · 팔레트 · 반응형 4BP) 완료. **PR#2(`2170f795`) · PR#3(`d0d76835`) · PR#4(`bc72219e`) 모두 master 머지 완료.** Session 50 반응형 1차 리뷰: CRITICAL 0 · HIGH 4 (1건 빌드차단 즉시 수정) · MED 5 · LOW 3. **다음: H3 사업자 정보 환경변수 + M7 CSP 헤더 → Phase 4 인프라(Vercel + Supabase staging/prod).**

---

## 진행 중 · 잔여 작업

### Phase 2 — Frontend 🔄

#### 6. Frontend Development

| 항목 | 상태 | 비고 |
|------|------|------|
| 2-F 콘텐츠 채우기 | ⬜ | GoodDays / Story / MyPage — 검색 엔진/SRP 는 완료 |
| 2-F2 상태관리 단일화 (ADR-004) | ✅ | Step A~D 완료 (Session 14~17) · Zustand 제거 · TanStack Query + useSupabaseSession 단일 소스 |
| 2-G1 디자인 폴리시 (Phase 1~3) | ✅ | Sessions 18~36 — 카트 풀페이지 · 게이지/레이더 통일 · 팔레트(gold accent + 섹션 로테이션) · CTA hover gold |
| 2-G2 반응형 4BP | ✅ | Sessions 37~49 — clamp 토큰화 · container queries · 햄버거 드로어 · tap-area sweep · 360/768/1024/1440 전 페이지 QA |
| 2-G3 프로덕션 마감 | 🔄 | H3 ✅ · M7 ✅ (proxy.ts nonce CSP) · 번들 감사 + Vercel 배포 잔여 |

#### 7. Content & Asset

| 항목 | 상태 | 비고 |
|------|------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | 프로토타입 내 일부 WebP · 본격 파이프라인 미구축 |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | Supabase 스키마 확정 후 설계 |

#### 프로덕션 전 필수 처리

| ID | 이슈 | 처리 시점 |
|----|------|-----------|
| A1 | ADR-004 Zustand 제거 이행 완료 확인 (`rg "from 'zustand'"` 0건) | ✅ Session 17 완료 (2026-04-18, `bc6e2258`) |
| H3 | 사업자 정보 소스코드 하드코딩 → 환경변수/DB 이관 | ✅ Session 51 — `NEXT_PUBLIC_BUSINESS_*` 5종 + `.env.example` 동기화 |
| M7 | CSP 등 보안 응답 헤더 최종 점검 → `next.config.ts headers()` | ✅ Session 51 검증 — `proxy.ts` nonce 기반 CSP + 정적 헤더 (HSTS/COOP/CORP/Permissions) 완비 |

#### 코드 리뷰 잔여

| 순서 | 대상 | 상태 |
|------|------|------|
| R-5 | 2-E 플로우 복구 + `/biz-inquiry` | ⬜ (RP 재이식 이후 필요 시) |
| Session 50 | 반응형 1차 리뷰 (Sessions 37~49) | ✅ 2026-04-20 — `memory/review_session37_49_responsive.md` (HIGH 4·MED 5·LOW 3 · HIGH-1 즉시 수정) |
| R-7 | 2-G3 프로덕션 마감 (CSP·env·빌드) | ⬜ |

---

### Phase 3 — Backend 🔄

> 계획 문서: `docs/backend-architecture-plan.md` · `docs/payments-flow.md` · `docs/payments-security-hardening.md`

#### 세션 로드맵 (P2-B/D/E/F/G/H · 현재 Session 8 완료)

| 세션 | 범위 | 상태 |
|------|------|------|
| Session 3~6 | P2-B B-1 ~ B-4 + 리뷰 Pass 1 | ✅ |
| Session 7 | B-5 정산 RPC + Resend 인프라 + Pass 1 A안 | ✅ |
| Session 8 | 결제 보안 하드닝 #1~#4 + 통합 테스트 A/C/B | ✅ |
| Session 11 | P2-D Resend 이메일 템플릿 + 보안 #3-4b (prod `?orderNumber=` 차단) | ✅ |
| Session 12 | P2-F DB 카트 인프라 — `cart_items` 테이블 + RLS 4종 + Repo/Service/API/테스트 | ✅ |
| Session 13 | P2-F guest cart merge 트리거 + RBAC (`profiles.role` + `is_admin()` + `requireAdmin` + ADR-003) | ✅ |
| Session 13.5 | Session 8~13 리뷰 하드닝 (CRITICAL 2 + HIGH 4 · migration 021) | ✅ |
| Session 14 | 카트 UI DB 연동 (hydrate + write-through mirror) + ADR-004 Step A (`useHasHydrated`) + C-M3 bulk RPC (migration 022) · E2E 스모크 통과 | ✅ |
| Session 15 | ADR-004 Step B — TanStack Query 도입 + `useCart*` 훅 + `useCartStore` 제거 | ✅ |
| Session 16 | ADR-004 Step C — `useSupabaseSession` + `useAuthStore`·`DEMO_CREDENTIALS` 제거 + BUG-004 근본 해결 | ✅ |
| Session 17 | ADR-004 Step D — zustand 의존성 제거 + `useToast` 분리 + AuthSyncProvider 하드닝 (리뷰 HIGH 4·MED 4·LOW 2) | ✅ |
| **Session 18+** | **P2-G 프로덕션 (반응형 4BP · CSP · 환경변수 · 번들 감사) / P2-H 인프라** | **⬜ (다음)** |
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
| P2-2 Supabase RLS 정책 (앱 레벨) | 🟡 | P0 6 테이블 + Session 12 `cart_items` 4 정책 + Session 13 `profiles_select_admin` · `profiles_update_admin` · `admin_audit` 정책 적용 |
| RBAC / 인가 정책 | ✅ | Session 13 — `profiles.role` enum + `is_admin()` + `grant/revoke_admin` RPC + `requireAdmin` 가드 (ADR-003) |
| 최종 보안 감사 | ⬜ | P2-2 완료 후 security-reviewer 전면 감사 |

#### Payment & Order 잔여

| 항목 | 상태 | 비고 |
|------|------|------|
| 정기배송 구독 엔진 | ⬜ | 정책 확정 대기 (Session 차후) |

---

### Phase 4 — Infrastructure 🔄

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프로젝트 설정 | ✅ | Session 52 — `goodthings-roasters.vercel.app` 배포 + 환경변수 18종 Import + CSP nonce 동적 렌더링 해결 |
| 외부 서비스 콜백 등록 | ✅ | Session 52 — Supabase Auth / Kakao Maps / Kakao OAuth / Naver OAuth (Toss 라이브 전환 시 추가) |
| Supabase 프로젝트 설정 | 🔄 | dev(`ceqewbbjuhtnarzgkzmx`) 완료 · staging/prod 분리 남음 |
| CI/CD 파이프라인 | ✅ | GitHub → Vercel 자동 배포 (master push 시 prod) |
| 모니터링 / 에러 트래킹 | ✅ | Session 53 — Vercel Analytics + Speed Insights (`609d3293`) · Sentry Next.js SDK + tunnelRoute `/monitoring` + source map 업로드 (`8b8f4562`) · 프로덕션 스모크 테스트 통과 |

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
| `docs/adr/ADR-003-rbac-role-separation.md` | RBAC 역할 분리 정책 |
| `docs/adr/ADR-004-state-management-simplification.md` | Zustand 제거 · TanStack Query 이행 로드맵 |
| `docs/security-research-2026-04-16.md` | Session 6 폴리시 — 업계 표준 리서치 근거 |
| `memory/project_backend_p2_session_plan.md` | 세션별 모델·에이전트 계획 |
