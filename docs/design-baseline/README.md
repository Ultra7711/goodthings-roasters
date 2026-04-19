---
title: Design Baseline — Session 33 (Claude Design 2차 실험 준비 완료)
captured_at: 2026-04-19
commit_head: f0fcc8d9
branch: claude/palette-experiment-v1
worktree: .claude/worktrees/design-polish
---

# Design Baseline — Session 33

> Claude Design **2차 실험** 을 위한 핸드오프 패키지. Session 22 1차 실험 실패(F1~F5) 재발 방지 + 전수 적용 여부 결정용.

## 핸드오프 구성 (9종)

| # | 파일 | 용도 |
|---|------|------|
| 01 | `01-screenshots-session33/` (14장) | 현 상태 스크린샷 1440x900 retina |
| 02 | `02-tokens.css` | 토큰 시스템 전체 (@theme + :root) |
| 03 | `03-consumer-map.md` | 토큰별 소비자 수 · UNUSED 플래그 (F1 방지) |
| 04 | `04-section-structure.md` | 섹션 margin/padding 실측 (F3·F4 방지) |
| 05 | `05-component-inventory.md` | 실존 컴포넌트 목록 (F2 방지) |
| 06 | `06-prototype-vs-current.md` | 프로토타입 vs 현 Next.js 구분 (F5 방지) |
| 07 | `07-prompt.md` | Claude Design 프롬프트 본문 (복사용) |
| 08 | `08-changes-since-session22.md` | Session 23~32 해결 이슈 타임라인 |
| 09 | `09-round2-scope-gate.md` | 스코프 + Gate 1/2/3 채택 기준 |

## 사용 순서

1. Claude Design 주간 리셋 (2026-04-23 전후) 이후 착수
2. `07-prompt.md` 본문 복사 → Claude Design 새 프로젝트
3. 첨부: 01~06 + 08 + 09 (토큰·스크린샷·가드레일·타임라인·게이트)
4. 출력 수신 → `09-round2-scope-gate.md` Gate 1 → Gate 2 → Gate 3 순차 평가
5. 통과 시 `globals.css` 토큰 swap 1커밋 → 시각 회귀 확인
6. 반려 시 Step 4 (글로벌 토큰 재조정) 단계로 이관

## 캡처 스크립트 (재실행 시)

```bash
# 일반 페이지 12장
cd next && node scripts/capture-design-baseline.mjs

# 인증 세션 저장 (수동 로그인 + 카트 세팅)
cd next && node scripts/capture-auth-setup.mjs

# 인증 페이지 2장 (mypage · checkout)
cd next && node scripts/capture-design-baseline-auth.mjs
```

## Session 22 실패 교훈 (재발 방지)

| 코드 | 증상 | 방지 문서 |
|------|------|-----------|
| F1 | 미사용 토큰(`--color-btn-primary-bg-hover` 등) 제안 | 03-consumer-map.md |
| F2 | 가공 컴포넌트(`LimitedBadge`) 참조 | 05-component-inventory.md |
| F3 | 섹션 padding/margin 오해 | 04-section-structure.md |
| F4 | 1.5% L-gap "동일" 로 처리 | 04-section-structure.md |
| F5 | `goodthings_v1.0.html` 를 현행으로 오인 | 06-prototype-vs-current.md |

## 롤백 전략

| 강도 | 명령 |
|------|------|
| 토큰 변경만 되돌리기 | `git revert <commit>` |
| 브랜치 폐기 | `git worktree remove .claude/worktrees/design-polish && git branch -D claude/palette-experiment-v1` |
| 원격까지 제거 | 위 + `git push origin --delete claude/palette-experiment-v1` |

`master` 는 독립 보존. 실험 실패해도 프로덕션 무영향.

## 은퇴 문서

- `claude-design-handoff.md` (Session 22 1차용) — **은퇴**. 본 패키지 (01~09) 로 대체.
- `session22-*.png` (14장) — Session 22 당시 참고용 보존.

## 검증

```bash
cd next && npx tsc --noEmit && npx vitest run && npx eslint src --max-warnings 0 && npx next build
```
