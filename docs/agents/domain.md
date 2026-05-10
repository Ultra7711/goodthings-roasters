# Domain Docs (GTR)

mattpocock-skills 의 engineering skill (`diagnose`, `improve-codebase-architecture`, `tdd`, `zoom-out`, `grill-with-docs`) 이 codebase 탐색 시 참조할 도메인 문서 layout + 소비 규칙.

## Before exploring, read these

GTR 은 **single-context** repo. root 에 `CONTEXT.md` 1개.

- **`CONTEXT.md`** (root) — 도메인 vocabulary, module map, routing, relationships
- **`docs/adr/ADR-*.md`** — 아키텍처 결정 기록
- **`CLAUDE.md`** (root + `next/`) — 작업 원칙 + 검증 규칙 + Next.js 16 breaking changes

GTR 추가 도메인 docs (다른 repo 와 다른 점):

- **`memory/feedback_*.md`** (local memory) — 절대/메타 규칙 + 디자인/UI/검증 규칙 + 워크플로우. CLAUDE.md 보완.
- **`memory/project_*_plan.md`** — 진행 중 sprint plan / carry-over
- **`memory/project_session*_complete.md`** — 세션별 완료 스냅샷 (S180+ 만 active, 이전은 archive/sessions/)
- **`docs/gtr-design-guide.md`** — 디자인 시스템 7파트
- **`docs/milestone.md`** — 프로젝트 진행 추적

탐색 우선순위:
1. `CONTEXT.md` — 도메인 vocabulary 학습 (가장 먼저)
2. `docs/adr/` — 작업 영역 관련 ADR
3. `CLAUDE.md` — 작업 원칙
4. 영역별 `memory/feedback_*.md` — 디테일 규칙 (특히 `feedback_design_baseline_1440.md`, `feedback_diagnose_first_meta_rule.md`, `feedback_official_docs_after_2_failures.md` 메타규칙)

## File structure

```
C:\Git\goodthings-roasters\
├── CONTEXT.md                         ← single-context root
├── CLAUDE.md                          ← root agent instructions
├── docs/
│   ├── adr/
│   │   ├── ADR-001-oauth-account-merge-policy.md
│   │   ├── ADR-002-payment-webhook-verification.md
│   │   ├── ADR-003-rbac-role-separation.md
│   │   ├── ADR-004-state-management-simplification.md
│   │   ├── ADR-006-admin-pages-api-separation.md
│   │   └── ADR-008-toss-billing-integration.md
│   ├── agents/                        ← 본 파일 위치
│   ├── gtr-design-guide.md
│   ├── milestone.md
│   └── ...
└── next/
    ├── CLAUDE.md                      ← Next.js 16 주의사항
    └── AGENTS.md                      ← Next.js 16 breaking changes
```

## Use the glossary's vocabulary

코드 / 가설 / 테스트 명명 / refactor 제안 / 메모리 작성 시 `CONTEXT.md` 의 도메인 용어 정확 사용.

`CONTEXT.md` 의 _Avoid_ 항목은 사용하지 말 것:
- `Item` (Cart Item 외) → `Product` 또는 `Cart Item` 명시
- `Period` (정기배송 주기) → `Cycle`
- `Basket` / `Bag` → `Cart`
- `Sidebar` / `Panel` (slide-in 패턴) → `Drawer`
- `Modal` (바텀시트) → `Sheet`

새 도메인 개념 발견 시:
- `CONTEXT.md` 에 추가 (또는 사용자 confirm 후 추가)
- 기존 용어 ambiguous 면 `Flagged Ambiguities` 섹션 갱신

## Flag ADR conflicts

기존 ADR 와 충돌하는 제안 시 명시 surface:

> _Contradicts ADR-004 (state management simplification) — but worth reopening because…_

특히 자주 인용되는 ADR:
- **ADR-002** payment webhook verification (Toss IP allowlist + signature 검증)
- **ADR-004** state management (TanStack Query + Zustand 단순화)
- **ADR-008** toss billing integration (subscription 결제)

## GTR 환경 특이사항

- **Issue tracker 미사용** — master 직 push 환경. carry-over memory 가 issue 역할 대체 (`memory/project_*_plan.md`)
- **Triage labels 미사용** — issue 자체 안 씀
- **세션 단위 작업** — S001~S203+ 진행. 세션 종료 시 `project_sessionN_complete.md` 작성 + `NEXT_SESSION.md` 덮어쓰기
- **운영 메모** — `~/.claude/projects/C--Git-goodthings-roasters/memory/` (gitignored, 사용자별)
