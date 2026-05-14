# 어드민 풀 구현 계획 (Admin Implementation Plan)

> **작성일:** 2026-04-27 (Session 92)
> **최종 업데이트:** 2026-05-14 (Session 230) — **마스터 통합** · 모든 어드민 일감을 본 문서로 일원화. detail spec 은 `memory/project_admin_*.md` 참조 link.
> **상태:** Group A/B/C/H/I/J/K ✅ / Group E·F 부분 / Architecture deepening (ADR-009) ✅ / Visual sweep §7-3 ✅.
> **SoT 원칙:** 본 문서 = 어드민 진행 추적 SoT. 디자인 reference = `docs/admin-design.md`. ADR = `docs/adr/ADR-009-*.md`. detail spec = `memory/project_admin_*.md`.

---

## §1. 진행 상태 매트릭스 (S230 기준)

| Group | DB | Lib | Admin UI | Storage | 상태 |
|-------|----|----|---------|---------|------|
| A 인프라 | — | — | ✅ 100% | ✅ buckets | ✅ S92~ |
| B 주문 | — | ✅ ordersServer | ✅ 80%+ | — | ✅ — 환불·CSV carry-over |
| C 사용자 | — | ✅ usersServer | ✅ 100% | — | ✅ |
| D 정기배송 | — | ✅ subscriptionsServer | 🟡 60% | — | 🟡 — D-2 상세 페이지 미완 |
| **E 상품** | ✅ (046) | ✅ admin/productsServer | 🟡 80% | ⏸️ DEC-7 대기 | 🟡 — new 재기획 + 이미지 업로드 carry-over |
| **F 카페 메뉴** | ✅ (047) | ✅ cafeMenuServer (admin variant ⏸️) | 🔴 placeholder | ⏸️ | 🔴 — admin UI 0% |
| **G 운영·문서** | — | — | ⏸️ 0% | — | ⏸️ — SOP + E2E 미작성 |
| H 사이트 설정 | ✅ (032/034) | ⚠️ lib/admin 분리 X | ✅ 100% | ✅ | 🟡 — lib 분리 carry-over |
| I 통계 | ✅ (033) | ✅ analyticsServer | ✅ 100% | — | ✅ |
| J 굿데이즈 | ✅ (036) | — | ✅ 100% | ✅ | ✅ |
| K cafe-events | ✅ (035) | ⚠️ lib/admin 분리 X | ✅ 100% | ✅ | 🟡 — lib 분리 carry-over |

**범례:** ✅ 완료 · 🟡 부분 · 🔴 미완 · ⏸️ 결정 대기

### 1-1. UI 통일성 (Group H · §5-23 칩 표준 · §7-3 hex)

| ID | 항목 | 상태 |
|---|---|---|
| H-1 ~ H-8 | 버튼/Input/Checkbox/행 클릭/SettingsCard/칩 표준 통일 | ✅ S228~S229 완료 |
| §7-3 Type 1 (#888 · #fff) | hex 직접 사용 정정 | ✅ S230 `981241d6` |
| §7-3 Type 2 (placeholder/info-border/sidebar-avatar) | 토큰 4종 신설 + 마이그 | ✅ S230 `981241d6` |
| §5-23 칩 표준 (`data-slot="chip-radio"`) | 6곳 일관화 | ✅ S229 `88754699` |

### 1-2. 구조 개선 (ADR-009 · DEC-8~18)

| DEC | 항목 | 상태 | 커밋 |
|---|---|---|---|
| DEC-8 | AdminPageHeader (5 페이지) | ✅ | S227+S229 |
| DEC-9 | AdminPagination (3 페이지) | ✅ | S227 |
| DEC-10 | AdminDataTable (4 페이지) | ✅ | S227+S228 |
| DEC-11 | AdminTabsNav (3 페이지) | ✅ | S227 |
| DEC-12 | AdminBackLink (2 페이지) | ✅ | S227+S229 |
| DEC-13 | Topbar disabled+tooltip 정책 | 🟡 일관 적용 잔여 | S230-4 |
| DEC-14 | AdminListMeta 폐기 (헤더 흡수) | ✅ | S227 |
| DEC-15 | lib/admin/errors.ts 단일 SoT | ✅ | S227 |
| DEC-16 | lib/admin/productsServer.ts 분리 | ✅ | S227 |
| DEC-17 | listHelpers (factory 폐기 · B안) | ✅ | S229 `afbb82f4` |
| DEC-18 | §5-23 칩 표준 | ✅ | S228 + S229 `88754699` |

---

## §2. Sprint 카탈로그

### Sprint 진행 현황

| Sprint | 범위 | 상태 | 추정 | 모델 |
|---|---|---|---|---|
| S218 | Group E Admin UI Phase 1 (목록+편집) | ✅ | 11~15h | Sonnet 4.6 |
| S219 | Group E Admin UI Phase 2 (보류) | ⏸️ Storage DEC-7 결정 대기 | 6~9h | — |
| S220 | Group F Admin UI (목록+등록+편집+이미지) | 🔴 미시작 | 9~12h | Sonnet 4.6 |
| S221 | Group G + D-2 + 마무리 | 🔴 미시작 | 6~8h | Sonnet 4.6 |
| S227 | Architecture audit + 6 컴포넌트 추출 | ✅ | — | — |
| S228 | Phase 2 PR-A (테이블 4종 마이그) | ✅ | — | — |
| S229 | Phase 2 PR-B/C + 칩 표준 + DEC-17 listHelpers | ✅ | — | — |
| **S230 (현재)** | Phase 3 잘못 구현 fix (§7-3 hex + 잔여 6 항목) | 🟡 §7-3 완료 / 6 항목 잔여 | 5~9h | Sonnet 4.6 |
| **S231** | products/new 재기획 (PDP 실 모델 기준) | 📋 | 12~16h | Sonnet 4.6 + mattpocock grill-with-docs |
| **S232** | 출시 전 carry-over (Users 필터 + Export CSV) | 📋 | 8~14h | Sonnet 4.6 |
| **S233** | **어드민 페이지 폴리싱** (마이크로 인터랙션 · A11y · 시각 다듬기) | 📋 | 6~10h | Sonnet 4.6 |
| **S234** | **최종 리뷰어 검토 sprint** (4 reviewer 일괄) | 📋 | 4~6h + 수정 | Opus 4.7 |
| **별** | improve-codebase-architecture 최종 (ADR-009 sweep) | 📋 | 8~10h | Opus 4.7 |

### 2-1. S230 잔여 (Phase 3 잘못 구현 fix · 5~9h)

| ID | 항목 | 추정 | 비고 |
|---|---|---|---|
| ✅ S230-1 | §7-3 Type 1 hex 정정 (#888·#fff) | — | `981241d6` |
| ✅ S230-2 | §7-3 Type 2 토큰 신설 + 마이그 | — | `981241d6` |
| **S230-3** | ProductEditForm shipping/seo 탭 결정 | 0.5~3h | **사용자 결정 필요** (옵션 A 두 탭 제거 / B 도메인 추가 / C 유지) |
| **S230-4** | Topbar 액션 disabled+tooltip 일관 적용 | 1h | DEC-13 적용 |
| **S230-5** | lib/admin/{cafeEvents,settings}.ts + Server 분리 | 2~3h | DEC-15/16 답습 |
| **S230-6** | admin-theme.css base layer 보강 | 0.5h | 필요 시 |
| **S230-7** | design.md §0 인덱스 갱신 | 0.5h | — |

### 2-2. S231 — products/new 재기획 (12~16h)

📄 spec: `memory/project_admin_product_new_replan.md`

| ID | 항목 | 추정 |
|---|---|---|
| S231-1 | 방향 결정 (옵션 A=ProductEditForm 답습+mode='create' / B=별 폼 / C=wizard) | 0.5h |
| S231-2 | RHF + zod 실 PDP 모델 기반 폼 | 5~7h |
| S231-3 | 이미지 업로드 (Storage + sharp+plaiceholder) | 3~4h |
| S231-4 | createProductAction Server Action | 2~3h |
| S231-5 | volumes / recipe / 5축 노트 / images 동적 행 UI | 2~3h |

### 2-3. S232 — 출시 전 carry-over (8~14h)

| ID | 항목 | 추정 | spec |
|---|---|---|---|
| S232-1 | Users 가입 채널 DropdownFilter | 2~3h | `memory/project_admin_users_filter_extension.md` |
| S232-2 | Subscriptions CSV export (사용자 요청) | 2~3h | `memory/project_admin_export_feature.md` |
| S232-3 | Orders CSV export (disabled UI 활성화) | 2~3h | 동일 |
| S232-4 | PII 정책 합의 (이메일/이름/전화 포함 여부 결정) | 1~2h | 별도 사용자 confirm |

### 2-4. S233 — 어드민 페이지 폴리싱 (6~10h · 신규)

**범위:** UI 통일성 / 구조 개선 / 미완 카탈로그 완료 후 — 출시 직전 마이크로 디테일 다듬기.

| ID | 항목 | 추정 | 검증 |
|---|---|---|---|
| S233-1 | **인터랙션 polishing** — hover/focus/active transition 일관 (~150ms ease-out) | 1~2h | 1440 inspect transition-duration |
| S233-2 | **로딩 상태 통일** — Skeleton + Spinner + isPending 패턴 일관 | 1~2h | 모든 페이지 데이터 fetch 시 시각 일관 |
| S233-3 | **빈 상태 (empty) 일관성** — AdminEmptyState variant 사용 검수 | 0.5~1h | message 톤 + 액션 슬롯 |
| S233-4 | **에러 메시지 톤 일관성** — Server Action error map 검수 (한국어 정중) | 0.5~1h | summarizePgError + error map 답습 |
| S233-5 | **Toast 메시지 일관성** — sonner toast 톤/duration/position 통일 | 0.5h | 모든 success/error toast |
| S233-6 | **접근성 (a11y)** — aria-label / focus visible / 키보드 탐색 검수 | 1~2h | 아이콘 버튼 24×24 + aria-label · Tab 순서 |
| S233-7 | **1440 baseline 최종 회귀** — 모든 admin 페이지 inspect computed value 검수 | 1~2h | feedback_design_baseline_1440 답습 · 1440→1024→768→360 |
| S233-8 | **모바일 회귀** (1024/768/360) — admin 모바일 사용 안 하지만 깨지지 않는지만 | 0.5h | 페이지 layout overflow X |

### 2-5. S234 — 최종 리뷰어 검토 sprint (4~6h + 수정 · 신규)

**범위:** S230~S233 완료 후, 출시 전 마지막 단계. 4 reviewer agent 일괄 호출 → 결과 메모리 저장 → CRITICAL/HIGH 수정.

| ID | 리뷰어 | 범위 | 산출 |
|---|---|---|---|
| S234-1 | **code-reviewer** | admin 코드 전수 — readability / pattern consistency / dead code | `memory/review_s234_general.md` |
| S234-2 | **security-reviewer** | auth / RLS / Server Action 권한 / PII 누출 / CSRF | `memory/review_s234_security.md` |
| S234-3 | **typescript-reviewer** | 타입 안정성 / any 잔존 / 제네릭 / discriminated union | `memory/review_s234_typescript.md` |
| S234-4 | **database-reviewer** | Supabase RLS 정합 / N+1 쿼리 / 인덱스 / 트랜잭션 | `memory/review_s234_database.md` |
| **S234-5** | 결과 통합 + CRITICAL/HIGH fix sprint | 별도 추정 (발견에 따라) | 메모리 + fix 커밋 |

**리뷰 트리거 시점:**
- S230~S232 완료 (출시 전 코어 작업 끝)
- S233 폴리싱 후 (시각 + 구조 안정 상태)
- 최종 commit 미push 상태에서 실행

**리뷰 결과 분류 (`~/.claude/rules/common/code-review.md` 답습):**
- CRITICAL → **BLOCK** 출시. 즉시 fix.
- HIGH → **WARN**. 출시 전 fix 권장.
- MEDIUM → carry-over (별 sprint)
- LOW → 기록만

### 2-6. 별 sprint — improve-codebase-architecture 최종 (8~10h)

📄 spec: `memory/project_admin_ui_unification_plan.md` §Sprint 5

mattpocock `improve-codebase-architecture` + `zoom-out` skill 본격 적용. S227 ~ S234 결과 audit 후 최종 refactor.

---

## §3. 우선순위 분류 (출시 기준)

### 3-1. 출시 전 — P1 (필수 · 21~32h)

| 항목 | sprint | 추정 |
|---|---|---|
| S230 잔여 6 항목 | S230 | 5~9h |
| products/new 재기획 | S231 | 12~16h |
| 어드민 페이지 폴리싱 | S233 | 6~10h |
| Users 가입 채널 필터 (사용자 요청) | S232-1 | 2~3h |
| Subscriptions CSV (사용자 요청) | S232-2 | 2~3h |
| Orders CSV (disabled 활성화) | S232-3 | 2~3h |
| 최종 리뷰어 검토 (4 reviewer + fix) | S234 | 4~6h + α |

### 3-2. 출시 후 1~2주 — P1 (~22~30h)

| 항목 | spec |
|---|---|
| Group F 카페 메뉴 admin UI | `memory/project_admin_ui_followup.md` §3 |
| Group E 이미지 업로드 Storage 통합 (DEC-7 β 채택 시) | `memory/project_admin_cafe_menu_upload.md` |
| Group E 옵션·레시피 관리 UI | 동일 §2 |

### 3-3. 출시 후 1개월 — P2 (~10~15h)

| 항목 |
|---|
| Group D-2 정기배송 상세 페이지 |
| Group G-1 SOP 문서 작성 |
| Group G-2 E2E 테스트 |
| Users CSV (PII 정책 합의 후) |
| Products CSV |

### 3-4. 출시 후 V2+ — P3 (~14~18h)

| 항목 |
|---|
| Users 구독상태 / 활성도 필터 (6개월 후 데이터 누적 후) |
| Excel export 옵션 |
| improve-codebase-architecture 최종 sweep |

---

## §4. 출시 전 결정 필요 항목

| ID | 항목 | 시점 | 옵션 |
|---|---|---|---|
| **DEC-7** | products 이미지 업로드 정책 | S231 진입 전 | α public 유지 / β Storage 도입 (권장) / γ 하이브리드 |
| **S230-3** | ProductEditForm shipping/seo 탭 | S230 진행 중 | A 두 탭 제거 / B 도메인 추가 / C 유지 |
| **DEC-export-4** | CSV PII 익명화 정책 | S232 진입 전 | 마스킹 / 평문 |
| **DEC-G1** | SOP 문서 범위 | S233/출시 직전 | 사업자용 / 개발자용 / 양쪽 |

---

## §5. carry-over spec link (memory/* 참조)

상세 spec 은 본 문서가 아닌 `memory/` 의 spec 파일 참조. 본 문서는 일감 추적 SoT.

| memory 파일 | 역할 |
|---|---|
| [project_admin_ui_unification_plan.md](../next/../memory/project_admin_ui_unification_plan.md) | UI 통일성 마스터 plan (S227~S231 sprint 카탈로그 + 12 사용자 지정 규칙) |
| [project_admin_ui_followup.md](../next/../memory/project_admin_ui_followup.md) | S217 미완 audit (Group E/F admin UI 일감 분해) |
| [project_admin_architecture_audit.md](../next/../memory/project_admin_architecture_audit.md) | S227 architecture audit (8 컴포넌트 + 3 lib candidate · LANGUAGE.md 답습) |
| [project_admin_product_new_replan.md](../next/../memory/project_admin_product_new_replan.md) | S231 products/new 재기획 spec (실 PDP 모델 + RHF) |
| [project_admin_users_filter_extension.md](../next/../memory/project_admin_users_filter_extension.md) | S232-1 Users 가입 채널 필터 spec |
| [project_admin_export_feature.md](../next/../memory/project_admin_export_feature.md) | S232-2/3 CSV export spec (Orders + Subscriptions) |
| [project_admin_cafe_menu_upload.md](../next/../memory/project_admin_cafe_menu_upload.md) | F-Admin-3 / Storage 통합 spec |
| [project_release_blocker_sprint.md](../next/../memory/project_release_blocker_sprint.md) | 출시 차단 sprint 카탈로그 (S210~S221) |
| [project_session{N}_complete.md](../next/../memory/) | 세션별 완료 스냅샷 (S227·S228·S229·...) |
| [NEXT_SESSION.md](../next/../memory/NEXT_SESSION.md) | 다음 세션 진입 prompt |

(상대 경로는 git tracked 가 아니므로 참고용. 실제 위치: `C:\Users\ideal\.claude\projects\C--Git-goodthings-roasters\memory\`)

---

## §6. 합계 추정

| 단계 | 합계 | 비고 |
|---|---|---|
| 출시 전 P1 (S230~S234) | **~32~50h** | 1.5~2주 풀타임 |
| 출시 후 1~2주 P1 | ~22~30h | Group E·F 어드민 UI |
| 출시 후 1개월 P2 | ~10~15h | D-2 + G-1/G-2 + Users/Products CSV |
| 출시 후 V2+ P3 | ~14~18h | 필터 확장 + Excel + arch sweep |
| **전체 잔여** | **~80~115h** | 출시 전 풀타임 1.5~2주 + 출시 후 3~4주 |

---

## §7. 완료 기록 (sprint 별)

### S227 — Architecture audit + 6 컴포넌트 추출 ✅

- mattpocock skill 본격 적용 (diagnose / improve-codebase-architecture / zoom-out)
- 6 공통 컴포넌트 추출 (AdminPageHeader/DataTable/Pagination/TabsNav/EmptyState/BackLink)
- lib/admin/errors.ts (DEC-15) + lib/admin/productsServer.ts 분리 (DEC-16)
- ADR-009 작성
- 8 후보 중 2 hypothetical seam 보류 (Drop/ListMeta)
- 커밋: `2e005e28..c18b972a`

### S228 — Phase 2 PR-A 테이블 4 페이지 마이그 ✅

- Orders/Users/Subscriptions/Products → AdminPageHeader/DataTable/TabsNav/Pagination 적용
- -304 LOC + 8 회귀 fix (Tailwind v4 cascade / admin-theme reset / Switch height 등)
- §5-23 칩 표준 신설 (DEC-18)
- 17 commits `fde3a148..04fb6d18`

### S229 — Phase 2 PR-B/C + 칩 표준 + DEC-17 listHelpers ✅

- PR-B 상세 3 파일 (AdminBackLink + AdminTopbarActions 합성)
- PR-C 단일 5 파일 (AdminPageHeader + §5-23 칩 + H-1/H-7)
- 칩 §5-23 표준 6곳 일관화 (`data-slot="chip-radio"` retrofit)
- **DEC-17 변경** — 풀 factory 폐기 → `lib/admin/listHelpers.ts` (AdminListResult<T,S,F> + applyRange + applyIlikeSearch)
- 학습 4종 (feedback memory 2건 신규)
- 8 commits `b1c4056b..c484569d`

### S230 — Phase 3 잘못 구현 fix (진행 중)

- §7-3 hex Type 1+2 일괄 정정 + 토큰 4종 신설 ✅ (`981241d6`)
- 잔여 6 항목 (탭 결정 / Topbar 정책 / lib 분리 / base layer / 인덱스 갱신)

---

## §8. 변경 이력

| 날짜 | 세션 | 변경 |
|---|---|---|
| 2026-04-27 | S92 | 초기 작성 — 정책 변경 + 작업 그룹 7개 |
| 2026-05-02 | S124 | Group H·I·J 추가 |
| 2026-05-11 | S209 | §0 진행률 신설 + 의존 audit 44개 + 출시 전 처리 확정 |
| 2026-05-13 | S217 | DB 전환 / Admin UI 두 열 분리 + P0/P1/P2 분류 |
| **2026-05-14** | **S230** | **마스터 통합 재구성** — 모든 어드민 일감 SoT 일원화 / Sprint 카탈로그 S230~S234 + 별 / 폴리싱 sprint §2-4 + 최종 리뷰어 검토 sprint §2-5 신설 / memory carry-over link 박음 / 합계 추정 갱신 |

---

## Appendix A. 초기 설계 자료 (S92~S217 historical)

> 본 섹션은 초기 설계 / 결정 배경 보존용. 진행 추적은 §1~§3 참조.

### A-1. UI 라이브러리 — shadcn/ui (S92 결정)

- 풀 어드민 50~70h 작업 규모 → 약 30% 단축 (35~50h)
- form / table / dialog / dropdown 등 표준 컴포넌트
- Tailwind 기반 (메인 사이트와 같은 빌드 파이프라인)
- 메인 디자인 시스템과 별도 — 어드민 전용 토큰·테마 (admin-theme.css)

### A-2. 이미지 업로드 — Supabase Storage (S92 결정)

옵션 비교 결과 Supabase Storage 채택:
- `is_admin()` RLS 헬퍼 (020 마이그레이션) 를 Storage 정책에 그대로 재사용
- 이미지 transform (resize/format/webp) 내장
- DB + Storage 백업 일원화
- 1만 장 돌파 시 R2 마이그레이션 옵션 보유

### A-3. 라우팅 구조 (S92 결정)

```
app/admin/
  login/page.tsx         # 별도 로그인 (메인 /login 과 분리)
  (authed)/
    layout.tsx           # RBAC 가드 + 사이드바 + 헤더
    page.tsx             # 대시보드 (간단한 통계)
    orders/              # 목록 + [orderNumber] 상세
    users/               # 목록 + [id] 상세
    products/            # 목록 + new + [slug]/edit
    menu/                # 목록 + new + [id]/edit (미완)
    subscriptions/       # 목록 + [id] 상세 (D-2 미완)
    analytics/
    gooddays/
    settings/
    cafe-events/
```

### A-4. 인증 흐름 (S92 결정)

- `/admin/login` 진입 → Supabase auth 로그인
- 로그인 성공 → `is_admin(user.id)` 검증
- admin 이면 `/admin` 리다이렉트, 아니면 403 + 자동 로그아웃
- `/admin/*` 모든 라우트 → `app/admin/(authed)/layout.tsx` 에서 `requireAdmin` 가드

### A-5. 클라이언트 의사결정 필요 항목 (S92 출처 · 상태 갱신)

| 항목 | 결정 | 상태 |
|---|---|---|
| admin 계정 운영 | 단일 계정 시작 (다계정은 boundary 발생 시 검토) | ✅ |
| 상품 카테고리 확장 | Coffee Bean / Drip Bag 만 (확장은 별 sprint) | ✅ 잠금 |
| 카페 메뉴 카테고리 | 시그니처/브루잉/티/논커피/디저트/기타 (어드민 편집 X) | ✅ 잠금 |
| 재고 관리 정밀도 | 옵션별 `soldOut` 토글만 (수량 X) | ✅ 잠금 |
| 상품 이미지 정책 | 다중 갤러리 (1번 = 대표) | ✅ 잠금 |
| 어드민 다국어 | 한국어만 | ✅ 잠금 |

### A-6. fetch 전환 영향 파일 (S209 audit · 44개 · 모두 마이그 완료)

- 상품 (E-4 영향) ~36개 — `lib/products.ts` 하드코딩 → DB ✅ S211/S212
- 카페 메뉴 (F-3 영향) ~8개 — `lib/cafeMenu.ts` 하드코딩 → DB ✅ S213/S214
