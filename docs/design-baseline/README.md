---
title: Design Baseline — Session 20 Phase 2 진입 전
commit: 8511f442
branch_base: claude/pixel-port
branch_experiment: claude/design-polish
captured_at: 2026-04-18
---

# Design Baseline (Session 20 진입 시점)

## 롤백 전략

**커밋 `8511f442` (= `claude/pixel-port` HEAD) 가 베이스라인 ground truth.**

| 강도 | 명령 | 효과 |
|------|------|------|
| 1. 커밋 되돌리기 | `git reset --hard 8511f442` (in design-polish) | 브랜치 유지, 작업만 폐기 |
| 2. 로컬 브랜치 삭제 | `git worktree remove .claude/worktrees/design-polish && git branch -D claude/design-polish` | 로컬 완전 제거 |
| 3. 원격까지 삭제 | 위 + `git push origin --delete claude/design-polish` | 흔적 전체 제거 |

`claude/pixel-port` 브랜치는 **독립적으로 보존**되므로, design-polish 가 실패해도 프로덕션 경로에 영향 없음.

## 스코프 (Phase 2)

| # | 항목 | 예상 영향 파일 |
|---|------|-------------|
| #27 | 1440px 좌우 패딩 0 | `.blk-header`·`.cat-grid`·`.phil`·`.hero-c` |
| #23 | Story vertical rhythm 120→80~96px | story page CSS |
| #22 | Story 지그재그 세로 중앙 정렬 | story page CSS |
| #26 | 골드 eyebrow 전역 강화 | globals.css (tokens) + 전역 class |
| #32 | 팔레트 재해석 (warm paper/stone/번트오렌지/오크 골드) | globals.css (tokens) |

## 캡처 대상 페이지

- `/` (홈)
- `/story`
- `/shop`
- `/menu`
- `/mypage`

스크린샷 JPEG 본은 별도 파일 저장이 아닌 **브랜치 자체로 보존**. 비교 시 `git checkout 8511f442` 혹은 `git worktree add` 로 양쪽 동시 비교.

## 검증 명령

```bash
cd next && npx tsc --noEmit && npx vitest run && npx eslint src --max-warnings 0
```
