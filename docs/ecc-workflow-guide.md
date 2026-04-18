# ECC Workflow Guide — HTML Prototype to Next.js Migration

> HTML 단일 파일 프로토타입을 Next.js 웹 애플리케이션으로 전환하는 프로젝트에서
> Everything Claude Code(ECC) 에이전트·스킬을 활용하는 워크플로우 가이드.
>
> **프로젝트:** Good Things Roasters
> **전환 대상:** `goodthings_v1.0.html` (11,100+ lines) → Next.js App Router
> **작성일:** 2026-04-10
> **이전 체계:** `product-design-agent` 스킬 (37개 역할 정의) → **폐기, 본 문서로 대체**

---

## 목차

1. [기존 체계 폐기 사유](#1-기존-체계-폐기-사유)
2. [ECC 에이전트 역할 분류](#2-ecc-에이전트-역할-분류)
3. [단계별 에이전트 배분 및 권장 스킬](#3-단계별-에이전트-배분-및-권장-스킬)
4. [개발 시 필수 규칙 (Rules)](#4-개발-시-필수-규칙-rules)
5. [에이전트 실행 패턴](#5-에이전트-실행-패턴)
6. [부록: product-design-agent → ECC 매핑표](#6-부록-product-design-agent--ecc-매핑표)

---

## 1. 기존 체계 폐기 사유

### product-design-agent의 한계

| 항목 | product-design-agent | ECC 에이전트 |
|------|---------------------|-------------|
| 실행 방식 | 같은 Claude 세션에서 프롬프트 전환 | 독립 프로세스로 병렬 실행 |
| 병렬 처리 | 불가 (순차 실행만 가능) | 동시 3~5개 에이전트 병렬 실행 |
| 전문 도구 | 모든 역할이 동일 도구 공유 | 에이전트별 전용 도구 세트 |
| 코드 수정 권한 | 모든 역할이 수정 가능 | 리뷰 에이전트는 읽기 전용 (안전) |
| 모델 선택 | 단일 모델 | 역할별 최적 모델 자동 배정 |
| 유지보수 | 37개 역할 정의를 수동 관리 | ECC 업데이트로 자동 개선 |

### 폐기 결정

- Phase 1 전체 + Phase 2-A까지 ECC 에이전트만으로 진행 완료, 품질 검증됨
- 병렬 코드 리뷰 (ts-reviewer × 3 + code-reviewer 동시 실행) 등 ECC가 더 효과적
- product-design-agent의 가치는 "단계별 워크플로우 정의"에 있었으며, 이는 본 문서로 승계

---

## 2. ECC 에이전트 역할 분류

### 이 프로젝트에서 사용하는 핵심 에이전트

| 분류 | 에이전트 | 모델 | 역할 | 사용 빈도 |
|------|---------|------|------|----------|
| **계획** | `planner` | opus | 복잡 기능 구현 계획 수립 | 매 Phase 시작 |
| **설계** | `architect` | opus | 시스템 설계, 아키텍처 결정 | Phase 전환 시 |
| **설계** | `code-architect` | sonnet | 기존 패턴 분석 → 구현 청사진 | 새 컴포넌트 설계 시 |
| **탐색** | `code-explorer` | sonnet | 실행 경로 추적, 의존성 매핑 | 프로토타입 코드 분석 시 |
| **리뷰** | `code-reviewer` | sonnet | 코드 품질, 패턴, 베스트 프랙티스 | **매 구현 후 필수** |
| **리뷰** | `typescript-reviewer` | sonnet | TS 타입 안전성, 비동기 정확성 | **매 구현 후 필수** |
| **보안** | `security-reviewer` | sonnet | OWASP Top 10, 시크릿 검출 | 인증·결제·API 코드 시 |
| **DB** | `database-reviewer` | sonnet | 쿼리 최적화, 스키마 설계 | Supabase 스키마 작업 시 |
| **빌드** | `build-error-resolver` | sonnet | 빌드/타입 에러 최소 변경 수정 | 빌드 실패 시 |
| **테스트** | `tdd-guide` | sonnet | 테스트 우선 개발, 80%+ 커버리지 | 새 기능, 버그 수정 시 |
| **E2E** | `e2e-runner` | sonnet | Playwright E2E 테스트 | 핵심 사용자 흐름 검증 |
| **성능** | `performance-optimizer` | sonnet | 번들 크기, 렌더링, CWV 최적화 | Phase 5 QA 시 |
| **SEO** | `seo-specialist` | sonnet | 메타태그, 구조화 데이터, CWV | Phase 5 QA 시 |
| **문서** | `doc-updater` | haiku | 코드맵, README 최신화 | 마일스톤 변경 시 |
| **정리** | `refactor-cleaner` | sonnet | 데드 코드 제거, 중복 통합 | Phase 완료 후 정리 시 |

### 상황별 보조 에이전트

| 에이전트 | 사용 조건 |
|---------|----------|
| `silent-failure-hunter` | 에러 처리 품질이 의심될 때 |
| `type-design-analyzer` | 타입 설계 복잡도가 높을 때 (상품 옵션, 주문 상태 등) |
| `comment-analyzer` | 주석 품질 감사 필요 시 |
| `code-simplifier` | 구현 후 복잡도 감소가 필요할 때 |
| `docs-lookup` | 라이브러리 API 확인 시 (Radix, Zustand, Next.js 등) |

### 이 프로젝트에서 사용하지 않는 에이전트

Python, Go, Rust, Java, Kotlin, C++, C#, Flutter, Dart, PyTorch 관련 에이전트,
오픈소스 파이프라인 에이전트, GAN 하네스 에이전트, healthcare-reviewer,
chief-of-staff 등은 이 프로젝트 범위 밖이므로 사용하지 않는다.

---

## 3. 단계별 에이전트 배분 및 권장 스킬

> 각 Phase는 기존 product-design-agent의 11개 그룹을 계승하되,
> 실행 주체를 ECC 에이전트로 교체한다.

### Phase 1 — Design (완료)

디자인 단계는 Claude 본체가 직접 수행하며, ECC 에이전트는 보조적으로 활용한다.

#### 1-1. Research

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Plan-research | Claude 본체 | 리서치 계획은 대화형으로 수립 |
| Competitor-analysis | Claude + `WebSearch` | 경쟁사 벤치마킹 |
| Synthesize-research | Claude 본체 | 인사이트 통합은 Claude 본체가 최적 |

**권장 스킬:** `search-first` (기존 리서치 자산 탐색)

#### 1-2. UX Writing

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| UX-writing | Claude 본체 | 브랜드 가이드 기반 카피 작성 |
| Copy-critique | Claude 본체 | 톤·길이·CTA 효과성 분석 |
| Writing-Workflow | Claude 본체 | 용어·맞춤법 검수 |

**권장 스킬:** 없음 (Claude 본체 역량으로 충분)

#### 1-3. Critique

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Design-critique | Claude 본체 | 비즈니스 목표 정렬, 시각적 위계 분석 |
| UI-critique | `code-reviewer` | 코드 레벨 토큰 일관성 감사 |
| Brand-consistency | Claude 본체 | 브랜드 가이드라인 준수 검수 |
| Design-QA | `typescript-reviewer` + `code-reviewer` **병렬** | 코드 품질 + 디자인 토큰 검증 |

**권장 스킬:** `coding-standards` (토큰 일관성 기준 자동 적용)

#### 1-4. UI Design

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| UI-pattern-analyzer | `code-explorer` | 프로토타입 UI 패턴 분석 |
| UI-generator | Claude 본체 | HTML/CSS 코드 직접 생성 |
| Interaction | Claude 본체 | 모션 토큰·인터랙션 스펙 정의 |

**권장 스킬:** `frontend-design` (프로덕션급 UI 품질 기준)

#### 1-5. Handoff

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Design-handoff | `planner` | 핸드오프 스펙을 구현 계획으로 직결 |
| Token-handoff | Claude 본체 | CSS Custom Properties 직접 변환 |
| Component-spec | `code-architect` | 컴포넌트 Props·상태·변형 명세 |

**권장 스킬:** 없음

---

### Phase 2 — Frontend (현재 진행 중)

프로토타입 → Next.js 전환의 핵심 단계. 에이전트 활용이 가장 집중적이다.

#### 2-A. 복합 UI 컴포넌트 (✅ 완료)

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| 프로토타입 분석 | `code-explorer` | 기존 Drawer/Modal/Toast 코드 추적 |
| 구현 계획 | `planner` | 컴포넌트 설계, 의존성 분석 |
| 코드 리뷰 | `typescript-reviewer` + `code-reviewer` **병렬** | R-1 리뷰 |

**권장 스킬:** `frontend-patterns` (React 컴포넌트 패턴), `docs-lookup` (Radix UI API 확인)

#### 2-B. 상품 상세 페이지

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| 프로토타입 분석 | `code-explorer` | 상품 상세 UI·인터랙션 코드 추적 |
| 구현 계획 | `planner` | 이미지 갤러리·구매 옵션·탭·영양정보 설계 |
| 아키텍처 | `code-architect` | Server/Client 경계 설계 (H5 Footer 분리 포함) |
| 코드 리뷰 | `typescript-reviewer` + `code-reviewer` **병렬** | R-2 리뷰 |

**권장 스킬:** `frontend-patterns` (상태 관리, 데이터 흐름)

#### 2-C. 장바구니·체크아웃

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| 구현 계획 | `planner` | CartDrawer·CheckoutForm·OrderComplete 설계 |
| 아키텍처 | `architect` | H6 Header 경계 재설계 |
| 코드 리뷰 | `typescript-reviewer` + `code-reviewer` + **`security-reviewer`** **병렬** | R-3 리뷰 |
| 타입 검증 | `type-design-analyzer` | 주문 상태 머신 타입 설계 검증 |

**권장 스킬:** `frontend-patterns`, `coding-standards`
**보안 필수:** 결제 관련 코드 → `security-reviewer` 투입

#### 2-D. 로그인·마이페이지

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| 구현 계획 | `planner` | LoginForm·MyPageLayout·OrderHistory 설계 |
| 코드 리뷰 | `typescript-reviewer` + `code-reviewer` + **`security-reviewer`** **병렬** | R-4 리뷰 |

**권장 스킬:** `frontend-patterns`, `coding-standards`
**보안 필수:** 인증 관련 코드 → `security-reviewer` 투입

#### 2-E. 반응형 전체 적용

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| 구현 계획 | `planner` | 4 브레이크포인트(360/768/1024/1440) 전략 |
| 코드 리뷰 | `typescript-reviewer` + `code-reviewer` **병렬** | R-5 리뷰 |
| E2E 테스트 | `e2e-runner` | 브레이크포인트별 스크린샷 비교 |

**권장 스킬:** `e2e-testing` (Playwright 반응형 테스트)

#### 2-F. 프로덕션 이슈 마무리

| 단계 | 에이전트 | 역할 |
|------|---------|------|
| H3 환경변수 이관 | `security-reviewer` | 하드코딩된 사업자 정보 검출·이관 검증 |
| M7 CSP 헤더 | `security-reviewer` | Content Security Policy 설정 검증 |
| 빌드 검증 | `build-error-resolver` | 최종 빌드 에러 해결 |
| 코드 리뷰 | `code-reviewer` + **`security-reviewer`** **병렬** | R-6 리뷰 |

**권장 스킬:** `verification-loop` (빌드·테스트·품질 게이트 종합 검증)

#### 7. Content & Asset

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Image-optimizer | Claude 본체 + Bash | WebP/AVIF 변환 스크립트 |
| Icon-system | Claude 본체 | SVG → React 컴포넌트 변환 |
| Content-mapper | `code-architect` | CMS/DB ↔ UI 데이터 매핑 설계 |

**권장 스킬:** 없음

---

### Phase 3 — Backend

#### 8. Data & API

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Schema-designer | `database-reviewer` + `architect` | Supabase 스키마 설계 + RLS |
| API-designer | `planner` + `code-architect` | Route Handler 구조 설계 |
| API-builder | `tdd-guide` | 테스트 우선 API 구현 |

**권장 스킬:** `postgres-patterns` (Supabase 최적화), `api-design` (REST 패턴), `backend-patterns` (서비스 레이어), `database-migrations` (마이그레이션)

#### 9. Auth & Security

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Auth-architect | `architect` + `security-reviewer` | 인증 플로우 설계 + 보안 검증 |
| Security-audit | `security-reviewer` | OWASP Top 10 전수 감사 |

**권장 스킬:** `backend-patterns` (미들웨어, 세션 관리)
**보안 필수:** 이 단계 전체에 `security-reviewer` 상시 투입

#### 10. Payment & Order

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Payment-integrator | `planner` + `security-reviewer` | 토스페이먼츠 연동 계획 + 보안 |
| Order-flow | `architect` + `type-design-analyzer` | 주문 상태 머신 설계 + 타입 검증 |
| Subscription-engine | `planner` | 정기배송 정책 확정 후 설계 |

**권장 스킬:** `api-design`, `backend-patterns`
**보안 필수:** 결제 코드 전체에 `security-reviewer` 상시 투입

---

### Phase 4 — Infrastructure

#### 11. DevOps & Deploy

| 기존 역할 | ECC 대체 | 비고 |
|----------|---------|------|
| Deploy-config | Claude 본체 | Vercel 설정, 환경변수, 도메인 |
| Monitoring-setup | Claude 본체 | Sentry, Vercel Analytics |
| Infra-manager | Claude 본체 | Supabase 프로젝트, 스토리지, 백업 |

**권장 스킬:** `verification-loop` (배포 전 최종 검증)

---

### Phase 5 — Quality Assurance

| 영역 | 에이전트 | 비고 |
|------|---------|------|
| 접근성 (WCAG 2.1 AA) | `code-reviewer` + `e2e-runner` | 자동 접근성 검수 + 키보드 테스트 |
| 성능 (Core Web Vitals) | `performance-optimizer` | 번들 최적화, CWV 목표 달성 |
| SEO | `seo-specialist` | 메타태그, 구조화 데이터 |
| 크로스 브라우저 QA | `e2e-runner` | Chrome/Safari/Firefox 테스트 |
| 시각 회귀 테스트 | `e2e-runner` | Playwright 스크린샷 비교 |

**권장 스킬:** `e2e-testing`, `verification-loop`

---

## 4. 개발 시 필수 규칙 (Rules)

> 프로젝트 일관성을 유지하기 위해 모든 단계에서 반드시 준수해야 하는 시스템 규칙.

### Rule 1: 구현 전 계획 필수

```
복잡도가 HIGH인 작업 → planner 에이전트로 계획 수립 → 사용자 승인 후 구현
```

- 3개 이상 파일에 영향을 주는 변경은 반드시 `planner`를 먼저 실행한다.
- 계획 없이 구현을 시작하지 않는다.
- 계획은 마일스톤 문서(`docs/milestone.md`)에 반영한다.

### Rule 2: 구현 후 코드 리뷰 필수

```
코드 작성/수정 → typescript-reviewer + code-reviewer 병렬 실행 → HIGH 전건 수정 후 커밋
```

- **모든 코드 변경**에 대해 최소 2개 리뷰어를 병렬 실행한다.
- 리뷰 결과 `CRITICAL`/`HIGH` 항목은 **커밋 전 반드시 수정**한다.
- 인증·결제·보안 관련 코드는 `security-reviewer`를 추가 투입한다.
- 리뷰 결과는 마일스톤 문서의 코드 리뷰 계획 섹션에 기록한다.

### Rule 3: 커밋 후 마일스톤 업데이트 필수

```
git commit → docs/milestone.md 해당 항목 상태 업데이트 → 별도 커밋
```

- 변경 내용이 있는 커밋 완료 후, 마일스톤 문서를 반드시 업데이트한다.
- 생략하지 않는다. (사용자 시간 낭비 방지)

### Rule 4: 디자인 토큰 일관성

```
하드코딩 금지 → CSS Custom Properties(var(--token-name)) 사용 필수
```

- 컬러, 폰트, 스페이싱, 모션, z-index 등 모든 시각적 속성은 디자인 토큰을 사용한다.
- 새 토큰이 필요하면 `globals.css`의 `@theme` 블록에 추가한다.
- 수정 전 `grep` 전수 조사, 수정 후 computed value 검증은 절대 생략하지 않는다.
- **스페이싱 토큰:** `--space-{n}` (4px 기반, n=배수) + `--layout-*` (레이아웃 전용) 체계를 사용한다.
  - 컴포넌트 내부 여백: `--space-1`(4px) ~ `--space-30`(120px)
  - 페이지 좌우 패딩: `--layout-padding-x`(60px)
  - 섹션 간격: `--section-gap`(120px)
  - 헤더·공지바 높이: `--header-height`(64px), `--ann-bar-height`(36px)
  - CSS Module에서 `padding: 24px` 같은 하드코딩 대신 `padding: var(--space-6)` 사용 필수

### Rule 5: 프로토타입 참조 (계획 단계 통합)

```
planner가 계획 수립 시 프로토타입 해당 섹션을 함께 분석 → 별도 선행 단계 불필요
```

- 별도의 "프로토타입 분석 Phase"를 두지 않는다. `planner` 에이전트가 계획을 세울 때 프로토타입(`goodthings_v1.0.html`)의 해당 섹션을 함께 참조한다.
- CSS 속성값, 애니메이션 타이밍, 인터랙션 패턴은 계획 단계에서 추출하여 구현 스펙에 포함한다.
- 프로토타입에 없는 새 패턴을 도입할 때는 디자인 가이드(`docs/gtr-design-guide.md`)와의 정합성을 확인한다.

### Rule 6: Server/Client 경계 명확화

```
'use client' 최소화 → Server Component 기본 → 인터랙션이 필요한 부분만 Client Component 분리
```

- 페이지 레벨(`page.tsx`)은 가능한 한 Server Component로 유지한다.
- `metadata` export가 필요한 페이지는 반드시 Server Component여야 한다.
- Client 인터랙션이 필요한 부분은 별도 `*Client.tsx` 래퍼로 분리한다.

### Rule 7: 타입 안전성

```
any 금지 → unknown + 타입 가드 사용 → API 응답·DB 테이블은 반드시 타입 정의
```

- TypeScript strict 모드를 유지한다.
- Props는 `type` 선언을 사용한다 (interface보다 type 선호).
- 외부 데이터(API 응답, DB 결과)에는 반드시 타입을 정의하고 런타임 검증을 고려한다.

### Rule 8: 접근성 기본 준수

```
시맨틱 HTML 우선 → aria 속성 보완 → 키보드 네비게이션 검증
```

- `<div>` 대신 시맨틱 요소(`<section>`, `<nav>`, `<main>`, `<article>`)를 우선 사용한다.
- 인터랙티브 요소에는 `aria-label` 또는 가시적 레이블을 제공한다.
- 장식용 SVG에는 `aria-hidden="true"`를 추가한다.
- Radix UI를 사용하여 접근성 기본값을 확보한다.

### Rule 9: 빌드 검증

```
코드 변경 → tsc --noEmit → next build → 둘 다 통과 후 커밋
```

- TypeScript 타입 체크와 Next.js 빌드를 모두 통과해야 커밋할 수 있다.
- 빌드 실패 시 `build-error-resolver`를 투입하여 최소 변경으로 해결한다.

### Rule 10: 보안 게이트

```
인증·결제·사용자 데이터 코드 → security-reviewer 필수 → CRITICAL 0건 확인 후 머지
```

- 인증, 결제, 개인정보 처리 코드는 `security-reviewer` 없이 커밋하지 않는다.
- 환경변수에 시크릿을 저장하고, 소스코드에 하드코딩하지 않는다.
- CSP, HSTS 등 보안 헤더를 배포 전 반드시 설정한다.

---

## 5. 에이전트 실행 패턴

### 패턴 A: 병렬 리뷰 (가장 빈번)

```
┌─ typescript-reviewer ─┐
│  타입 안전성, TS 패턴   │
├────────────────────────┤  ← 병렬 실행
│  code-reviewer         │
│  코드 품질, 패턴        │
└────────────────────────┘
         ↓
   결과 종합 → 중복 제거 → HIGH 전건 수정
```

**사용 시점:** 모든 코드 구현 후
**결과 처리:** 두 리뷰어의 결과를 종합, 중복 제거, severity별 분류 후 HIGH 이상 전건 수정

### 패턴 B: 보안 강화 리뷰 (인증·결제 시)

```
┌─ typescript-reviewer ─┐
├─ code-reviewer ────────┤  ← 3개 병렬 실행
├─ security-reviewer ────┤
└────────────────────────┘
         ↓
   결과 종합 → CRITICAL 즉시 수정 → HIGH 전건 수정
```

**사용 시점:** 인증, 결제, 개인정보 처리 코드 구현 후

### 패턴 C: 설계 → 구현 → 리뷰 풀사이클

```
planner → (사용자 승인) → code-architect → 구현 → 패턴 A/B 리뷰 → 수정 → tsc + build → 커밋
```

**사용 시점:** 새 Phase 또는 복잡 기능 시작 시

### 패턴 D: 프로토타입 분석 → 이식

```
code-explorer (프로토타입 분석) → 패턴 추출 → Next.js 컴포넌트 구현 → 패턴 A 리뷰
```

**사용 시점:** 프로토타입의 특정 기능을 Next.js로 전환할 때

### 패턴 E: QA 종합 검증

```
┌─ performance-optimizer ─┐
├─ seo-specialist ─────────┤  ← 병렬 실행
├─ e2e-runner ─────────────┤
└──────────────────────────┘
         ↓
   결과 종합 → CWV 목표 대비 → 개선 사항 도출
```

**사용 시점:** Phase 5 품질 보증 단계

---

## 6. 부록: product-design-agent → ECC 매핑표

> 기존 37개 역할이 ECC 에이전트·스킬로 어떻게 대체되는지 전체 매핑.

| # | 기존 역할 | Phase | ECC 대체 | 비고 |
|---|----------|-------|---------|------|
| 1 | Plan-research | 1-Research | Claude 본체 | 대화형 리서치 설계 |
| 2 | Synthesize-research | 1-Research | Claude 본체 | 인사이트 통합 |
| 3 | Organize-survey | 1-Research | Claude 본체 | 데이터 구조화 |
| 4 | Analyze-survey | 1-Research | Claude 본체 | 분포·세그먼트 분석 |
| 5 | Organize-interview | 1-Research | Claude 본체 | 녹취 구조화 |
| 6 | Analyze-interview | 1-Research | Claude 본체 | 테마 코딩 |
| 7 | Organize-UT | 1-Research | Claude 본체 | 테스트 로그 구조화 |
| 8 | Analyze-UT | 1-Research | Claude 본체 | 성공률·에러 분석 |
| 9 | Competitor-analysis | 1-Research | Claude + `WebSearch` | 벤치마킹 |
| 10 | Analytics-insight | 1-Research | Claude 본체 | GA/Hotjar 분석 |
| 11 | Archive-research | 1-Research | Claude + 메모리 시스템 | 지식 자산화 |
| 12 | Archive-user | 1-Research | Claude + 메모리 시스템 | 유저 DB 기록 |
| 13 | UX-writing | 2-UX Writing | Claude 본체 | 카피 작성 |
| 14 | Copy-critique | 2-UX Writing | Claude 본체 | 카피 분석 |
| 15 | Writing-Workflow | 2-UX Writing | Claude 본체 | 검수 워크플로우 |
| 16 | Term-check | 2-UX Writing | Claude 본체 | 용어 검사 |
| 17 | Spell-check | 2-UX Writing | Claude 본체 | 맞춤법 검사 |
| 18 | Design-critique | 3-Critique | Claude 본체 | 디자인 비평 |
| 19 | UX-critique | 3-Critique | Claude 본체 | UX 비평 |
| 20 | UI-critique | 3-Critique | `code-reviewer` | 코드 레벨 UI 검증 |
| 21 | Brand-consistency | 3-Critique | Claude 본체 | 브랜드 일관성 |
| 22 | Design-QA | 3-Critique | `typescript-reviewer` + `code-reviewer` | 병렬 QA |
| 23 | UI-pattern-analyzer | 4-UI Design | `code-explorer` | 패턴 분석 |
| 24 | UI-generator | 4-UI Design | Claude 본체 | UI 코드 생성 |
| 25 | Responsive-converter | 4-UI Design | Claude 본체 | 반응형 변환 |
| 26 | Design-to-code | 4-UI Design | Claude 본체 | 시안 → 코드 |
| 27 | Interaction | 4-UI Design | Claude 본체 | 인터랙션 스펙 |
| 28 | Design-handoff | 5-Handoff | `planner` | 핸드오프 → 계획 |
| 29 | Token-handoff | 5-Handoff | Claude 본체 | CSS 토큰 변환 |
| 30 | Component-spec | 5-Handoff | `code-architect` | 컴포넌트 명세 |
| 31 | Component-builder | 6-Frontend | Claude 본체 + `tdd-guide` | 컴포넌트 구현 |
| 32 | Style-system | 6-Frontend | Claude 본체 | 스타일 시스템 |
| 33 | Animation-engineer | 6-Frontend | Claude 본체 | 애니메이션 구현 |
| 34 | Responsive-implement | 6-Frontend | Claude 본체 + `e2e-runner` | 반응형 구현 |
| 35 | Image-optimizer | 7-Content | Claude + Bash | 이미지 최적화 |
| 36 | Icon-system | 7-Content | Claude 본체 | 아이콘 시스템 |
| 37 | Content-mapper | 7-Content | `code-architect` | 콘텐츠 매핑 |
| 38 | Schema-designer | 8-Data & API | `database-reviewer` + `architect` | DB 스키마 |
| 39 | API-designer | 8-Data & API | `planner` + `code-architect` | API 설계 |
| 40 | API-builder | 8-Data & API | `tdd-guide` | API 구현 |
| 41 | Auth-architect | 9-Auth | `architect` + `security-reviewer` | 인증 설계 |
| 42 | Security-audit | 9-Auth | `security-reviewer` | 보안 감사 |
| 43 | Payment-integrator | 10-Payment | `planner` + `security-reviewer` | 결제 연동 |
| 44 | Order-flow | 10-Payment | `architect` + `type-design-analyzer` | 주문 플로우 |
| 45 | Subscription-engine | 10-Payment | `planner` | 정기배송 |
| 46 | Deploy-config | 11-DevOps | Claude 본체 | 배포 설정 |
| 47 | Monitoring-setup | 11-DevOps | Claude 본체 | 모니터링 |
| 48 | Infra-manager | 11-DevOps | Claude 본체 | 인프라 관리 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-10 | 초안 작성. product-design-agent 폐기, ECC 워크플로우 가이드로 대체 |
