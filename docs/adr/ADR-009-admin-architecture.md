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

## §10 — S256-A SettingsForm 분리 (DEC-18 잠금)

> **Date:** 2026-05-23 · **Session:** S256-A · **Trigger:** `memory/audit_s254_architecture.md` 의 god component 식별 (SettingsForm 1670 lines / 4 섹션 + 10 useState · CRITICAL)

### Context

S227 본 ADR 의 6 컴포넌트 추출은 **테이블/페이지 헤더/페이지네이션** 같은 가로 leverage 였다. 이후 S232~S253 어드민 기능 확장으로 settings 페이지의 단일 폼이 4 영역 (Shipping/Notice/Signature/HomeFeatured) 으로 누적. S237 시그니처 iframe 모델 도입 후 Signature 영역만 270 lines + 4 upload state + 4 refs + iframe postMessage listener 보유. S248 HomeFeatured 추가로 1670 lines 도달.

audit_s254_architecture.md 의 architect agent 결과:
- 단일 파일 SettingsForm 1670 lines (CRITICAL)
- 같은 패턴이 ProductEditForm 1513 (MEDIUM · 3탭 분리 됨)
- 신규 설계 원칙 후보 (파일 800 lines · props 8 · useState 5 임계값)

### Decision

#### D1. 4 SubForm + `_shared/` 디렉터리 분리

```
settings/
  page.tsx                      (변경 없음 · server)
  actions.ts                    (변경 없음 · S255-A HIGH-4 fresh fetch 유지)
  SettingsForm.tsx              Orchestrator (~280 lines)
  sections/
    ShippingSubForm.tsx         ~90 lines
    NoticeSubForm.tsx           ~150 lines  (shipping read-only prop · composeNoticeText)
    SignatureSubForm.tsx        ~640 lines  (Section 3 + ImageUploadSlot + AspectInput)
    HomeFeaturedSubForm.tsx     ~380 lines  (Slot/Add/MenuPicker/MetaBadges 통합)
  _shared/
    SettingsCard.tsx · SubCard.tsx · Badge.tsx · FormField.tsx · FormInput.tsx
    helpers.ts                  (shallowEqual* 4종 · format · describe* · buildPreviewSrc 등)
```

#### D2. State Ownership 원칙

| 카테고리 | Owner | 근거 |
|---|---|---|
| `savedSettings` / `settings` / `isPending` / `dirtyCount` | **Orchestrator** | save/reset 의 SoT · 영역 간 dirty 비교 필요 |
| Section 1/2/4 의 sub-state | 없음 (props only) | 영역 단순 — 자체 state 불필요 |
| Section 3 upload state (`htmlUpload` / `desktopUpload` / `tabletUpload` / `mobileUpload`) | **SignatureSubForm** | upload 진행/에러 표시 — orchestrator 가 알 필요 없음 |
| Section 3 refs (`htmlInputRef` 등 4종) | **SignatureSubForm** | input click 트리거 전용 |
| Section 3 htmlText/htmlTextOpen | **SignatureSubForm** | 토글 + 텍스트 임시 보관 |
| Preview state (`previewBrk` / `previewSrc` / `previewHeight`) | **Orchestrator** | Preview iframe 위치 유지 (D3) — orchestrator 가 직접 렌더 |
| Signature debounce effect + iframe postMessage listener | **Orchestrator** | Preview iframe owner = listener owner |

#### D3. Signature Preview iframe 위치 유지

Preview iframe (810~867 lines) 는 **현재 위치 (Section 4 HomeFeatured 다음) 그대로 유지**. orchestrator 가 직접 렌더하고 `previewBrk/Src/Height` state + signature debounce + postMessage listener 도 orchestrator 보유. **이유:**
- 시각 변경 0 (회귀 risk 차단)
- SignatureSubForm 인터페이스 단순화 (Preview state 를 props 로 안 받음)
- iframe + parent state sync 가 별 ADR 만들 만큼 복잡하지 않음 (단순 listener)

대안 (Preview 를 Section 3 안으로 통합 · cohesion 우선) 은 거부 — 분리 작업의 시각 회귀 risk 가 cohesion 이득보다 큼.

#### D4. 신규 설계 임계값 (DEC-18)

다음 sprint 부터 자동 분리 후보 신호:

| 신호 | 임계값 | 액션 |
|---|---|---|
| 파일 lines | > 800 | 분리 후보 등록 |
| 컴포넌트 props | > 8 | Discriminated Union / config object 검토 |
| 내부 useState | > 5 | 섹션/sub-component 분리 신호 |

audit 시 위 신호 발견 → architect agent + ADR 등록 후 분리. **기준 위반 = 즉시 분리 의무 아님** — ROI/risk 평가 후 sprint 분할.

### Consequences

#### 긍정

- **Locality** — Section 3 의 upload state + handlers + UI 가 단일 모듈에 집중. 변경 영역 visibility ↑.
- **Test surface** — 각 SubForm 단위 테스트 가능 (현재 SettingsForm 통째 mount 만 가능).
- **Deletion test ✅** — 4 SubForm + _shared 5 컴포넌트 삭제 시 1670 lines god component 재출현 = real seam.
- **재사용 가능성** — _shared/ 의 SettingsCard/SubCard/Badge/FormField/FormInput 은 다른 admin 폼에서도 활용 가능. (현재는 settings 전용 — 향후 caller 등장 시 `components/admin/` 으로 승격.)
- **DEC-18 임계값 reference** — ProductEditForm 1513 등 후속 분리 작업의 진입 기준 박음.

#### 부정

- **파일 수 증가** — 1 파일 → 10 파일. 디렉터리 nesting (`sections/` + `_shared/`) 학습 비용.
- **state lift drilling** — `onChange={updateNotice}` 같은 callback 4종 props 통과. (단 patch 패턴이라 type-safe.)
- **Signature debounce / postMessage 가 orchestrator 잔존** — Preview 위치 유지 (D3) 의 trade-off. cohesion 측 sub-optimal 이지만 시각 변경 0 우선.

### Implementation Order

```
1. _shared/helpers.ts + 5 공용 UI 컴포넌트 (다른 모듈이 의존하므로 먼저)
2. sections/ShippingSubForm.tsx + NoticeSubForm.tsx (단순)
3. sections/SignatureSubForm.tsx (가장 큼 · 4 upload state)
4. sections/HomeFeaturedSubForm.tsx (S248 답습 통합)
5. SettingsForm.tsx orchestrator 재작성 (모두 import)
6. npx tsc --noEmit + npx vitest run + 1440 시각 회귀
7. commit (refactor(admin/settings): SettingsForm 4 SubForm 분리 (S256-A))
```

### Alternatives Considered

#### (A) Context API 도입 (settings + setters 모두 context 로)

- 4 SubForm 이 useContext 로 settings 접근. props drilling 0.
- **거부 이유:** dirty 계산이 orchestrator 책임 + 4 SubForm 모두 settings.* 한 영역만 사용 → context 불필요 over-engineering. patch callback 4종이 명시적이고 type-safe.

#### (B) Preview 를 SignatureSubForm 안으로 통합

- cohesion 측 자연스러움.
- **거부 이유:** 시각 변경 (Preview 가 Section 4 위로 이동) → 회귀 risk + 사용자 confirm 시 추천 거부.

#### (C) ADR-005 신설 (admin-form-decomposition)

- SettingsForm + ProductEditForm + 향후 다른 god component 분리 공통 원칙 ADR.
- **거부 이유 (사용자 결정):** ADR-009 가 이미 admin-architecture sweep 의 SoT. §10 후속 섹션으로 sprawl 회피. 임계값 DEC-18 도 본 §10 안에 잠금.

### 향후 적용 후보

| 대상 | lines | 우선순위 | sprint |
|------|-------|---------|--------|
| **SettingsForm** | 1670 | 본 sprint | S256-A ✅ |
| ProductEditForm | 1513 | MEDIUM (3탭 분리 됨) | S260 후보 |
| OrdersTableClient | 584 | MEDIUM | S256-C ✅ 완료 |
| products/actions.ts | 1095 | HIGH | S256-B ✅ 완료 |
