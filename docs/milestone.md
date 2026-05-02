# GTR 프로젝트 마일스톤

> Good Things Roasters 웹사이트 프로젝트의 **잔여 작업** 을 추적한다.
> 완료 이력은 `docs/milestone-completed.md` 참조.
>
> **최종 업데이트:** 2026-05-02 · Session 127 — 어드민 시각 폴리싱 (`e0789aa9`). 폰트 Pretendard 통일 — Fraunces serif 폐기 (`--font-serif` 변수 + `.gtr-admin h1/h2/h3` font-family 룰 + inline `var(--font-serif)` 22곳 + `gtr-serif` 클래스 2곳 + globals.css Google Fonts `@import` 모두 정리, 네트워크 요청 1개 절약). 로그인·사이드바 'G' 박스 → 메인 사이트 SiteHeader 와 동일한 워드마크 SVG (`viewBox 0 0 680 142`) 교체 — 로그인 height 32px · 사이드바 height 20px + "ROASTERS · ADMIN" 캡션. 사이드바 brand 정렬 보정 — `alignItems: flex-start` 로 SVG stretch (195px → 정상 95.77px) 차단 + `marginLeft: -3` 으로 글리프 좌측을 메뉴 라인 22px 와 정렬. 사용자 공유 computed `width: 195px` 단서로 부모 flex stretch 진단 (메타 규칙 ① 효과 입증 — 마진값 추측 patch 누적 회피). 백엔드 Group B/D/H 진입은 S128 carry-over. 417/417 vitest · tsc 0 errors. 상세 `memory/project_session127_complete.md`.
> 이전: Session 126 — 어드민 시안 5종 화면 풀 이식 (`1c9151c0`, login·analytics·orders·products/new·settings). Session 125 — 어드민 시안 inline style 100% 이식 (`adcd39e0`, dashboard + shell). Session 124 — 어드민 풀 구축 진입 (Group A 인프라 + Claude Design 핸드오프) (`f5f700bc`).

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
| Phase 2 — Frontend | 7 | 1 | 0 | ~95% |
| Phase 3 — Backend | 3 | 1 | 0 | ~75% |
| Phase 4 — Infrastructure | 4 | 1 | 0 | ~85% |
| Phase 5 — QA | 0 | 0 | 3 | 0% |
| 어드민 풀 구축 (출시 전 신규 영역) | 0 | 1 (A 진행 중) | 9 | ~5% |
| User AI | 0 | 0 | 1 | 0% |

**현재 위치 (S125 종료, 2026-05-02):**

- Sessions 18~49 디자인 폴리시·반응형 4BP 완료. Sessions 51~60 Phase 4 인프라(Vercel·Supabase·Sentry) + Phase 1 인터랙션 ②⑤⑧.
- BUG-006 Tier 3 Stage C+D ✅ Session 66 (`9f954e90`) — Activity preserve + route-change event. 후속 묶음 A~E (S73~S77) 모두 closure.
- BUG-100~178 polishing 대거 closure (Sessions 70~98). 결제 사고 BUG-172 closure (S91, public_token 컬럼 + virtualAccount 분기).
- 정기배송 백엔드 Group B+C ✅ Session 111. 카페 메뉴 좋아요 기능 ✅ Sessions 100·101. likes 외부 store 격리 ✅ Session 116.
- 이미지 최적화 Phase 1 ✅ Session 121 (next/image · LQIP). yet-another-react-lightbox 라이브러리 컨버전 ✅ S121 + 잔존 1·2 closure ✅ S122·S123.
- 코드 리뷰 R-SEC(S104·109) · R-FE1(S105~107) · R-FE3(S108) · R-FE2(S113) · R-S113/S114(S116) 진행. R-SEC 잔여 M-6/M-7/M-8/L-2/L-4.
- **다음 큰 영역:** 어드민 풀 구축 (`docs/admin-implementation-plan.md` · `project_admin_subscription_plan.md`) — 출시 전 확정. 정기배송 풀 구현은 어드민 후속.

---

## 진행 중 · 잔여 작업

### Phase 2 — Frontend 🔄

#### 6. Frontend Development

| 항목 | 상태 | 비고 |
|------|------|------|
| 2-F 콘텐츠 채우기 | ✅ | GoodDays(42장 + 라이트박스) · Story(실콘텐츠 + 진입 연출) · MyPage(ManageSection 완성) 모두 완결 (2026-04-16 시점 확인) · 그 이후 S99 마이페이지 아코디언 · S100 카페 메뉴 좋아요 · S111 정기배송 · S113 마이페이지 폴리싱 등으로 더 풍부해짐. 검색 시스템(엔진+오버레이+SRP) 도 RP-10 으로 완료 |
| 2-F2 상태관리 단일화 (ADR-004) | ✅ | Step A~D 완료 (S14~17) · Zustand 제거 · TanStack Query + useSupabaseSession 단일 소스. S116 카페 메뉴 likes 도 외부 store 패턴으로 일관성 확보 |
| 2-G1 디자인 폴리시 (Phase 1~3) | ✅ | Sessions 18~36 — 카트 풀페이지 · 게이지/레이더 통일 · 팔레트(gold accent) · CTA hover gold |
| 2-G2 반응형 4BP | ✅ | Sessions 37~49 — clamp 토큰화 · container queries · 햄버거 드로어 · tap-area sweep · 360/768/1024/1440 전 페이지 QA |
| 2-G3 프로덕션 마감 | 🔄 | H3 ✅ · H4 ✅ · H5 ✅ · H6 🟡 (S120 보류, RUM 재평가) · M7 ✅ · M8 ✅ (S120 23개 셀렉터 audit) · 번들 감사 + 최종 R-7 리뷰 잔여 |
| 2-H BUG-006 Tier 3 (instant navigation) | ✅ | Stage A·B·C·D 완료 (S66, `9f954e90`) — Activity preserve + `gtr:route-change` event + effectivePath 패턴. 후속 묶음 A~E (S73~S77) 모두 closure (BUG-130/131/132/133/134/135/138/139/140/144~147) |
| 2-I 결제·체크아웃 정상화 | ✅ | S62~S63 — PGRST202 (Turbopack 스코프) 해소 · CSP Toss wildcard · 공용 데모 키 교체 · 비회원 주문 silent return 수정 · loadFailed CTA · Toss "이전" bfcache 복원 · 모바일 축약. **S86~87 BUG-115 옵션 Z** (마이그레이션 023/024 + paymentService 9종 provider 매핑). **S91 BUG-172 결제 사고 복구** (`34f351be`, public_token 컬럼 + virtualAccount 분기 정합화) |
| 2-J 카페 메뉴 좋아요 + 진입 연출 | ✅ | S100/S101 좋아요 기능 + 하트 버튼 리디자인. **S116 likes 외부 store 격리 (옵션 B)** — `menuLikesStore` (useSyncExternalStore) + sort/뱃지 분리 + ShopPage 패턴 회귀 |

#### 7. Content & Asset

| 항목 | 상태 | 비고 |
|------|------|------|
| 이미지 최적화 (WebP/AVIF) | 🔄 | **Phase 1 ✅ Session 121** — next/image 마이그레이션 + LQIP (50장 굿데이즈 갤러리 blur placeholder) + 라이트박스 라이브러리 컨버전 (yet-another-react-lightbox). Phase 2 (Supabase Storage 업로드) 어드민 Group A-6/E/F 묶음 · **Storage Transform (Pro $25/월) 은 서비스 출시 후 RUM 기반 재평가** · Phase 3/4 출시 후. 4-Phase 계획: `memory/project_image_optimization_plan.md` |
| 콘텐츠 매핑 (DB↔UI) | ⬜ | 어드민 Group E (상품) · F (카페 메뉴) 와 함께 처리 — `lib/products.ts` · `lib/cafeMenu.ts` 하드코딩 → DB 이전 |

#### 프로덕션 전 필수 처리

> 단일 진입점: `memory/project_pre_production_checklist.md`

| ID | 이슈 | 상태 |
|----|------|------|
| A1 | ADR-004 Zustand 제거 이행 완료 확인 | ✅ S17 (2026-04-18, `bc6e2258`) |
| H3 | 사업자 정보 → 환경변수/DB 이관 | ✅ S51 — `NEXT_PUBLIC_BUSINESS_*` 5종 + `.env.example` |
| H4 | Pretendard CDN → `next/font/local` 전환 (SRI) | ✅ 적용 확인 (S120) — `layout.tsx` `localFont` + `PretendardVariable.woff2` |
| H5 | Footer `'use client'` → BizInfoToggle 분리 | ✅ 분리 확인 (S120) — `SiteFooter` server + `FooterBottom`/`FooterWholesaleLink` client |
| H6 | Header Server/Client 경계 재설계 | 🟡 S120 보류 — wrapper 가 useHeaderTheme/headerRef 의존으로 client 필수, SSR 효용 미미 (LCP 후보 아님). 출시 후 RUM 데이터로 재평가. 근거 상세: `memory/project_pre_production_checklist.md` H6 보류 근거 섹션 |
| M7 | CSP 등 보안 응답 헤더 점검 | ✅ S51 — `proxy.ts` nonce CSP + HSTS/COOP/CORP/Permissions |
| M8 | globals.css font-family 감사 (27개 후보 클래스) | ✅ S120 — 23개 수정 (한글 22 / 숫자 1) · dead CSS 2건 별건 노트 |

#### 코드 리뷰 잔여

| 순서 | 대상 | 상태 | 비고 |
|------|------|------|------|
| R-5 | 2-E 플로우 복구 + `/biz-inquiry` | ⬜ | 필요 시 |
| Session 50 | 반응형 1차 리뷰 (S37~49) | ✅ | `memory/review_session37_49_responsive.md` (HIGH 4·MED 5·LOW 3) |
| R-7 | 2-G3 프로덕션 마감 (CSP·env·빌드 최종) | ⬜ | Vercel 배포 후 번들 감사 포함 |
| R-SEC | API Routes + 인증 + 결제 보안 리뷰 | 🟡 | S104 1차 + S109 2차 — M-2/M-5/L-1/L-3 closure · M-9 verified · **잔여 M-6/M-7/M-8/L-2/L-4** (Phase 3) · `memory/review_rsec_20260429.md` |
| R-FE1 | Cart + Checkout UI 도메인 리뷰 | ✅ | S105~107 — CRITICAL 0·HIGH 4·MEDIUM 15·LOW 8 전체 closure · `memory/review_fe1_20260429.md` |
| R-FE2 | 정기배송 백엔드 리뷰 | ✅ | S113 — HIGH 5·MEDIUM 6·LOW 4 정리 · `memory/review_fe2_20260430.md` |
| R-FE3 | MyPage · Cafe · Shop 도메인 리뷰 | ✅ | S108 — HIGH 2·MEDIUM 3·LOW 5 closure · `memory/review_fe3_20260429.md` |
| R-S113/S114 | 카트·좋아요·메뉴소팅·샵탭 변경분 | ✅ | S116 — CRITICAL 0·HIGH 0·MEDIUM 1 (toggle deps) 승인 · `memory/review_s113s114_20260430.md` |
| R-ADMIN | 어드민 풀 구축 후 보안·UI 리뷰 | ⬜ | 어드민 Group A~G 완료 후 |

---

### Phase 3 — Backend 🔄

> 계획 문서: `docs/backend-architecture-plan.md` · `docs/payments-flow.md` · `docs/payments-security-hardening.md`

#### 세션 로드맵

| 세션 | 범위 | 상태 |
|------|------|------|
| Sessions 3~8 | P2-B 결제 (B-1 ~ B-5) + 보안 하드닝 #1~#4 + 통합 테스트 | ✅ |
| Session 11 | P2-D Resend 이메일 + 보안 #3-4b (prod `?orderNumber=` 차단) | ✅ |
| Sessions 12~13.5 | P2-F 카트 DB + RBAC (ADR-003) + 리뷰 하드닝 | ✅ |
| Sessions 14~17 | ADR-004 Step A~D — TanStack Query · `useSupabaseSession` · zustand 제거 | ✅ |
| Session 86~87 | BUG-115 옵션 Z 결제수단 백엔드/프런트 — 마이그레이션 023/024 + paymentService 9종 provider 매핑 | ✅ |
| Session 91 | BUG-172 결제 사고 복구 — public_token 컬럼 누락 + virtualAccount 분기 코드/CHECK 제약 정합화 | ✅ |
| Session 111 | P2-C 정기배송 백엔드 Group B+C — subscriptionRepo + 7개 Route Handler + MyPagePage real API 연동 | ✅ |

> 세부 세션별 범위는 `memory/project_backend_p2_session_plan.md` 참조.

#### Auth & Security 잔여

| 항목 | 상태 | 비고 |
|------|------|------|
| P2-2 Supabase RLS 정책 (앱 레벨) | 🟡 | P0 6 테이블 + S12 cart_items + S13 admin/audit + S111 subscription_changes/holidays 정책 적용 · 어드민 Group A 진입 시 풀 점검 |
| RBAC / 인가 정책 | ✅ | S13 — `profiles.role` enum + `is_admin()` + `requireAdmin` 가드 (ADR-003) |
| 최종 보안 감사 | ⬜ | P2-2 + 어드민 완료 후 security-reviewer 전면 감사 + R-SEC 잔여(M-6/M-7/M-8/L-2/L-4) 처리 |

#### Payment & Order

| 항목 | 상태 | 비고 |
|------|------|------|
| 토스페이먼츠 결제 + 웹훅 + 정산 | ✅ | S3~S8 완료 + S11 이메일 통합 + S86~91 옵션 Z + 결제 사고 복구 |
| 정기배송 구독 엔진 (조회·일시정지·해지) | ✅ | S111 — 7개 Route Handler |
| **정기배송 자동 결제 집행 (cron/schedule)** | ⬜ | Phase 3 후속 — `project_adr005_subscription_cycles_queue.md` (ADR-005 예정) |

#### 어드민 풀 구축에 따른 백엔드 잔여

> 진입점: `project_admin_subscription_plan.md` · 작업 리스트: `docs/admin-implementation-plan.md` · `docs/subscription-full-implementation-plan.md`

| 영역 | 상태 | 비고 |
|------|------|------|
| 상품 도메인 DB 마이그레이션 | ⬜ | `next/src/lib/products.ts` (295줄) 하드코딩 → DB. 어드민 Group E 가장 큰 작업 (20~29h) |
| 카페 메뉴 도메인 DB 마이그레이션 | ⬜ | `next/src/lib/cafeMenu.ts` 하드코딩 → DB. 어드민 Group F (12~17h) |
| Supabase Storage 버킷 | ⬜ | `product-images` · `menu-images` · `is_admin()` RLS 재사용 |
| Production Supabase 마이그레이션 005·019~024 적용 | ⬜ | S91 사고 재발 방지용 — 어드민 Group A 진입 전 검증 필수 |

---

### Phase 4 — Infrastructure 🔄

| 항목 | 상태 | 비고 |
|------|------|------|
| Vercel 프로젝트 설정 | ✅ | S52 — 환경변수 18종 Import + CSP nonce 동적 렌더링 |
| 외부 서비스 콜백 등록 | ✅ | S52 — Supabase Auth · Kakao Maps · Kakao OAuth · Naver OAuth (Toss 라이브 전환 시 추가) |
| Supabase 프로젝트 설정 | 🔄 | dev(`ceqewbbjuhtnarzgkzmx`) ✅ · staging/prod 분리 잔여 |
| CI/CD 파이프라인 | ✅ | GitHub → Vercel (master push 시 prod) |
| 모니터링 / 에러 트래킹 | ✅ | S53 — Vercel Analytics + Speed Insights · Sentry SDK + tunnelRoute |
| **Toss 라이브 키 교체** | ⬜ | 출시 직전 — `project_production_toss_key_migration.md` (S91 사고이력 반영, 위젯 키 vs 개별 연동 키 호환성 매트릭스) |

---

### 어드민 풀 구축 (출시 전 신규 영역) ⬜

> **단일 진입점:** `memory/project_admin_subscription_plan.md` (S92 정책 변경 — 풀 어드민 출시 전 확정)
>
> **작업 리스트:**
> - `docs/admin-implementation-plan.md` — 풀 어드민 (Group A~G, 56~80h, 9단계)
> - `docs/subscription-full-implementation-plan.md` — 정기배송 풀 (어드민 후속, 14~19h)

| Group | 영역 | 상태 |
|-------|------|------|
| A | Foundation (`/admin/login` + 인증·RLS 점검) | ⬜ |
| B | Orders (주문 관리) | ⬜ |
| C | Users (사용자 관리) | ⬜ |
| D | Subscriptions (정기배송 관리) | ⬜ |
| E | Products (상품 도메인 DB + 어드민 UI) | ⬜ 가장 큰 작업 (20~29h) |
| F | Cafe Menu (카페 메뉴 도메인 DB + 어드민 UI) | ⬜ 12~17h |
| G | Etc (대시보드 · 통계 · 잡무) | ⬜ |
| 후속 | 정기배송 풀 구현 (자동 결제 집행 · 휴일 큐 등) | ⬜ 14~19h |

**클라이언트 의사결정 대기:** admin 계정 정책 · 상품 카테고리 확장 · 재고 정밀도 · 정기배송 출시 시점/할인율 · 주기 옵션 · 자동 결제 SLA · 해지 정책. 자세한 항목 `project_admin_subscription_plan.md §클라이언트 의사결정`.

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
| `docs/admin-implementation-plan.md` | **[출시 전 작업]** 풀 어드민 작업 리스트 (Group A~G, 56~80h) |
| `docs/subscription-full-implementation-plan.md` | **[어드민 후속]** 정기배송 풀 구현 작업 리스트 (14~19h) |
| `docs/backend-architecture-plan.md` | 14주 백엔드 로드맵 |
| `docs/payments-flow.md` | 결제 플로우 스펙 (v1.0.7) |
| `docs/payments-security-hardening.md` | S8 보안 #1~#4 스펙 + 4b 이행 |
| `docs/email-infrastructure.md` | Resend 인프라 + 템플릿 설계 |
| `docs/settlement-report.md` | S7 정산 RPC 스펙 |
| `docs/bug-and-polishing.md` | Phase 4 이후 버그 + 폴리싱 추적 (BUG-100 이후) |
| `docs/bug006-reproduction-protocol.md` | BUG-006 12섹션 재현 프로토콜 |
| `docs/adr/ADR-001-oauth-account-merge-policy.md` | OAuth 계정 병합 정책 |
| `docs/adr/ADR-002-payment-webhook-verification.md` | 결제 웹훅 하이브리드 인증 |
| `docs/adr/ADR-003-rbac-role-separation.md` | RBAC 역할 분리 정책 |
| `docs/adr/ADR-004-state-management-simplification.md` | Zustand 제거 · TanStack Query 이행 |
| `docs/security-research-2026-04-16.md` | S6 폴리시 — 업계 표준 리서치 근거 |
| `memory/project_admin_subscription_plan.md` | **[진입점]** 어드민 + 정기배송 풀 구현 |
| `memory/project_pre_production_checklist.md` | 프로덕션 전 필수 처리 체크리스트 |
| `memory/project_backend_p2_session_plan.md` | 세션별 모델·에이전트 계획 |
| `memory/project_production_toss_key_migration.md` | Toss 라이브 키 교체 (S91 사고이력 포함) |
| `memory/project_bug006_north_star.md` | **[불변]** BUG-006 목표·성공 조건·금지 |
| `memory/project_bug006_decisions_log.md` | BUG-006 의사결정 D-001~D-026 |
| `memory/project_bug006_deferred_bugs.md` | BUG-006 deferred 카탈로그 (BUG-136~139 승격) |
| `memory/project_flash_debugging_failure_catalog.md` | Flash 디버깅 금지 패턴 X1~X10 |
| `memory/feedback_research_before_proposal.md` | **🚨 [절대 규칙]** 외부 표준 리서치 의무 |
| `memory/feedback_animation_timing_speculative_patches.md` | **🚨 [절대 규칙 · S116]** 진입 연출 추측 patch 금지 |
