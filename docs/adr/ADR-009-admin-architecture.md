# ADR-009 — Admin architecture: 공통 컴포넌트 추출 + lib 레이어 deepening

- **Status:** Accepted
- **Date:** 2026-05-14
- **Session:** S227 — Architecture audit + 표준 컴포넌트 추출
- **Related:** ADR-006 (admin pages ↔ API 분리) / ADR-007 (shadcn 채택) / ADR-008 (visual sweep tokenization)
- **Supersedes:** 없음 (3 ADR 위 보강)
- **Implementation:** S227 Phase B (본 sprint) + S229 DEC-17 B안 (createAdminFetcher 폐기 → listHelpers 추출 · `afbb82f4`)

## Context

`docs/admin-implementation-plan.md §1-1` 의 shadcn/ui 도입과 ADR-007/008 결정 후, S225 (admin-design.md 1013 LOC 박음) + S226 (sweep 잔여 4 파일 토큰화) 에 도달했다. S226 audit (`memory/project_admin_ui_unification_plan.md`) 가 다음을 식별:

- 공통 UI 컴포넌트 빈약 — 8 후보 (AdminPageHeader / Pagination / ListMeta / EmptyState / TabsNav / DropdownFilter / DataTable / BackLink) 미추출
- shadcn `Table` / `Tabs` 미마이그 — 4 페이지 inline 답습
- lib/admin server fetcher 누락 3 도메인 — products / cafeEvents / settings

S227 Phase A 에서 mattpocock `diagnose` + `improve-codebase-architecture` + `zoom-out` skill 본격 적용 — `memory/project_admin_architecture_audit.md` 산출. LANGUAGE.md "Two adapters = real seam" principle 로 8 후보 검증 결과:

| 후보 | 답습 인스턴스 | Real seam? |
|---|---|---|
| AdminPageHeader | 5 | ✅ |
| AdminDataTable | 4 | ✅ |
| AdminEmptyState | 4 | ✅ |
| AdminPagination | 3 | ✅ |
| AdminTabsNav | 3 | ✅ |
| AdminBackLink | 2 | ✅ |
| **AdminDropdownFilter** | **1** | **❌ hypothetical** |
| **AdminListMeta** | **1** | **❌ hypothetical** |

8 → 6 추출. 동시에 lib 레이어 deepening 3 candidate 식별 (factory / errors / products 분리).

## Decision

### 1. UI 컴포넌트 6종 추출 (DEC-8~12 잠금 / DEC-14 변경)

`src/components/admin/` 하위 신규 6 파일:

| 컴포넌트 | DEC | 추출 사유 |
|---|---|---|
| `AdminPageHeader.tsx` | DEC-8 | 5 페이지 inline 답습 (title + subtitle + count 통합) |
| `AdminDataTable.tsx` | DEC-10 | 4 테이블 페이지 TH/TD inline 답습 — shadcn `Table` 위 합성 |
| `AdminEmptyState.tsx` | — | 4 테이블 colSpan fallback 답습 (table-row · card variant) |
| `AdminPagination.tsx` | DEC-9 | 3 테이블 페이지 26×26 `PAGE_BUTTON_BASE` 답습 (URL state · local state 양 모드) |
| `AdminTabsNav.tsx` | DEC-11 | 3 페이지 URL state Link + count badge 답습 (discriminated union: url \| state) |
| `AdminBackLink.tsx` | DEC-12 | 2 상세 페이지 "← 목록" 답습 |

추출 보류 (hypothetical seam · 1 caller):

- **AdminDropdownFilter** — Orders only. Subscriptions 의 filter 는 Dialog 내부 (구조 다름). 두 번째 caller 등장 시 추출.
- **AdminListMeta** — Products only outlier. **DEC-14 변경** — outlier 정정 = 헤더 subtitle 로 흡수 (별 컴포넌트 불필요).

### 2. lib 레이어 deepening — Phase B 동시 진행 + Phase B 후반 보류

본 sprint 진행:

- **`lib/admin/errors.ts`** (Candidate B) — `summarizePgError` 3 곳 답습 (`ordersServer.ts:37-57` + `subscriptionsServer.ts:35-46` + `usersServer.ts`) → 단일 export + `AdminError` class + `isAdminPrivilegeError(err)` guard.
- **`lib/admin/productsServer.ts`** (Candidate C 부분) — `lib/productsServer.ts:100+` 안 `listAdminProductsLite` 분리. B2C 부분은 `lib/productsServer.ts` 잔존.

본 sprint 보류 (별 PR 권장):

- **`createAdminFetcher` factory** (Candidate A) — 4 도메인 마이그 + RPC count + RLS 회귀 risk 가 본 sprint 범위 초과. **S229 별 PR carry-over**.
  - **S229 재진단 (`afbb82f4`)** — 풀 factory 폐기, B안 (공통 helper 추출) 채택. 근거: products 패턴 안 맞고 (no pagination/counts), 3 도메인도 counts 모드 / search 복잡도 차이로 factory config 가 원본만큼 복잡 (shallow interface). 대안 = `lib/admin/listHelpers.ts` 의 `AdminListResult<T,S,F>` 타입 + `applyRange` + `applyIlikeSearch` 3종.
- **cafeEvents/siteSettings lib/admin 이동** — drift risk 작고 단일 caller. S229 lib 레이어 정리 시 동시.

### 3. DEC 변경 / 신설 잠금

| DEC | 변경 | 사유 |
|---|---|---|
| DEC-8 | 유지 ✅ | 5 페이지 real seam |
| DEC-9 | 유지 ✅ | 3 페이지 real seam |
| DEC-10 | 유지 ✅ | 4 페이지 real seam |
| DEC-11 | 유지 ✅ | 3 페이지 real seam |
| DEC-12 | 유지 ✅ | 2 페이지 real seam |
| DEC-13 | 유지 ✅ | Topbar disabled tooltip 정책 (mock 제거) |
| **DEC-14** | **변경** — AdminListMeta 추출 → /products outlier 정정만 (헤더 subtitle 흡수) | 1 caller hypothetical seam |
| **DEC-15** (신규) | `lib/admin/errors.ts` 단일 정의 + `summarizePgError` 3 곳 답습 폐기 | 3 곳 중복 → 단일 SoT |
| **DEC-16** (신규) | `lib/admin/productsServer.ts` 분리 — B2C `lib/productsServer.ts` 와 admin variant 분리 | locality 회복 (orders/users/subscriptions 패턴 답습) |
| **DEC-17** (변경 · S229) | 풀 factory 폐기 → `lib/admin/listHelpers.ts` 의 `AdminListResult<T,S,F>` + `applyRange` + `applyIlikeSearch` 3종 helper 추출. 3 도메인 (orders/users/subscriptions) 마이그 (`afbb82f4`). | 재진단: products 패턴 안 맞음 (no pagination/counts) + 3 도메인 차이가 factory 추상화 비용보다 큼 (shallow interface 위험) |

### 4. 컴포넌트 Interface 설계 (LANGUAGE.md "interface = type + invariants + ordering + error modes + config")

각 컴포넌트의 props / invariant / shadcn 베이스는 `memory/project_admin_architecture_audit.md §4` 참조. 핵심 결정:

- **AdminDataTable** = `Column<T>` 배열 + `data` + `rowKey` + `onRowClick`. **Cell color hierarchy = caller 책임** (column `render` 가 직접 className 결정 — S225 잠금 답습).
- **AdminTabsNav** = `discriminated union` (`mode: 'url'` ⊕ `mode: 'state'`) — caller 가 잘못 사용 시 type error.
- **AdminEmptyState** = `discriminated union` (`variant: 'table-row'` ⊕ `variant: 'card'`).
- **AdminPagination** = `buildHref?` 또는 `onPageChange?` — 둘 중 하나만 사용 (URL vs local). 둘 다 미지정 시 disabled.

## Consequences

### 긍정 (LANGUAGE.md depth + locality + leverage)

- **Locality** — 6 컴포넌트 × 4~5 페이지 = inline 답습 ~480 LOC 단일화. shadcn `Table`/`Tabs` 활용 0% → 100%.
- **Leverage** — 신규 admin 페이지 추가 시 컴포넌트 합성만. inline 답습 학습 불필요.
- **Deletion test ✅** — 6 컴포넌트 삭제 시 4~5 페이지에 ~480 LOC 재출현 = real seam 증명.
- **lib/admin 일관성** — orders/users/subscriptions 패턴이 products / errors module 에 확장.
- **Test surface 회복** — `summarizePgError` / `parseSearchParams` 단위 테스트 가능. 컴포넌트 props 단위 테스트 가능 (현재 페이지 end-to-end 만 가능).

### 부정

- **회귀 위험** — 4 테이블 페이지 동시 마이그 = 1440 baseline 회귀 검증 필수. S225 cell color hierarchy + design.md §5 패턴 정합 확인.
- **새 추상화 학습** — `AdminDataTable Column<T>` / `AdminTabsNav discriminated union` 학습 필요. design.md §13 본격 작성으로 reference 박음.
- **추정 시간 증가** — 본 sprint 12~16h → 14~18h (errors + productsServer 분리 추가).

### 적용 범위 (S227 Phase B)

S227 본 sprint:
- 6 컴포넌트 추출 (위 표)
- `lib/admin/errors.ts` 신설 + 3 도메인 마이그
- `lib/admin/productsServer.ts` 신설 + B2C `lib/productsServer.ts` 의 admin variant 이관

S228 carry-over (완료):
- 페이지별 6 컴포넌트 실 적용 (PR-A: 테이블 4종 / PR-B: 상세 페이지 / PR-C: 단일 페이지) ✅

S229 후속 (완료):
- DEC-17 변경 — 풀 factory 폐기, `lib/admin/listHelpers.ts` (AdminListResult + applyRange + applyIlikeSearch) 추출 (`afbb82f4`) ✅

S229~S231 (마스터 plan §3 답습):
- §7-3 hex Type 1/2 정정 (Sprint 3)
- products/new 재기획 (Sprint 4)
- improve-codebase-architecture 최종 refactor (Sprint 5)

## Alternatives Considered

### (A) 마스터 plan 그대로 — 8 컴포넌트 모두 추출

- AdminDropdownFilter + AdminListMeta 도 추출 (DEC-14 유지).
- **거부 이유**: LANGUAGE.md "Two adapters = real seam" 위반. 1 caller = hypothetical seam = dead-ish code. 미래 사용 대비 (speculative) 는 deletion test 미통과.

### (B) 6 컴포넌트만 + lib 작업 보류

- Real seam 6종만 추출. errors / productsServer 분리는 S229 별 sprint.
- **거부 이유 (사용자 결정)**: lib 작업이 컴포넌트 작업과 독립 + 회귀 risk 작음. 본 sprint 동시 처리가 효율적. 단 `createAdminFetcher` factory 는 회귀 risk 커서 별 PR 분리 → **S229 재진단 후 폐기, listHelpers 추출로 대체** (`afbb82f4`).

### (C) lib 통합 — `lib/admin/index.ts` barrel

- 모든 lib/admin 모듈 단일 import path.
- **거부 이유**: Next.js 16 tree-shaking 영향 불명. barrel re-export 가 cacheComponents 가시성에 영향 가능 (`next/AGENTS.md` 답습 — Next.js 16 breaking changes 우선). 본 sprint 범위 초과.

## Implementation Notes

### 본 sprint 진입 순서 (Phase B)

```
1. lib/admin/errors.ts 신설  (10~15 LOC)
2. ordersServer / subscriptionsServer / usersServer 의 summarizePgError 폐기 + errors.ts import
3. AdminEmptyState.tsx 신설 (가장 작음 + 다른 컴포넌트 의존)
4. AdminBackLink.tsx 신설
5. AdminPageHeader.tsx 신설
6. AdminPagination.tsx 신설 (PAGE_BUTTON_BASE 답습)
7. AdminTabsNav.tsx 신설 (discriminated union)
8. AdminDataTable.tsx 신설 (shadcn Table 합성 · 가장 큼)
9. lib/admin/productsServer.ts 신설 + lib/productsServer.ts:100+ 마이그
10. cd next && npx tsc --noEmit 통과 확인
```

### 페이지별 마이그는 S228 carry-over

본 sprint 는 **컴포넌트 추출 + export 확인**만. 페이지별 실 적용 (orders/users/products/subscriptions inline 답습 → 컴포넌트 호출) 은 S228 PR-A/B/C 로 분할.

### 회귀 차단

각 컴포넌트 추출 후:
- `npx tsc --noEmit` 통과
- 컴포넌트 자체 import 만 검증 (페이지 적용 없으므로 시각 변화 0)
- design.md §13 본격 작성 (사용법 + import 경로 박음)

페이지별 마이그 시 (S228) :
- 1440 baseline visual 회귀 (`feedback_design_baseline_1440.md`)
- cell color hierarchy 정합 (S225 잠금)
- design.md §5 패턴 답습 확인 (`feedback_inspection_complete_pass`)

### mattpocock skill 적용 흔적

본 ADR + `memory/project_admin_architecture_audit.md` 는 CLAUDE.md 박혀 있지만 흔적 0 이던 mattpocock-skills 본격 적용 산출:

- `diagnose` — Phase 3 ranked list to user before testing 답습 (8 후보 → 6 추출 confirm)
- `improve-codebase-architecture` — Explore + Present Candidates + LANGUAGE.md 어휘 (Module / Interface / Depth / Seam / Adapter / Leverage / Locality / Deletion test / Two adapters)
- `zoom-out` — domain module map + caller 분포

향후 admin sprint 진입 시 동일 skill 답습 — `feedback_diagnose_first_meta_rule.md` 와 함께 standard procedure.
