---
title: Session 22 이후 변경 타임라인 (F5 방지 — 이미 해결된 이슈 재제안 차단)
created: 2026-04-19
status: Session 33 핸드오프
---

# Session 22 이후 변경 타임라인

> **목적:** Claude Design 2차 실험 시, Session 22 **1차 핸드오프 이후** 이미 해결된 디자인 이슈를 재제안하지 않도록 변경 이력 명시.
>
> **사용법:** Claude Design 에 이 문서 첨부 → 아래 "해결됨" 항목 재제안 금지.

## Session 23 (2026-04-18) — BUG 일괄 해결

- **BUG-003** `/cart` 풀페이지 구현 (드로어에서 이식)
- **BUG-004** 헤더 유저 아이콘 중복 제거
- **BUG-005** 로그인 리다이렉트 경로 일원화
- 커밋: `e8d891bb`, `326e747c`

## Session 24 (2026-04-18) — master 병합 정리

- PR1 머지 (`2170f795`)
- design-polish rebase + ESLint 0/0 달성 (`6305e415`)

## Session 25 (2026-04-18) — Phase 2 디자인 폴리시

해결된 이슈 (PR #3, 커밋 `c194f39c`):
- #17 카트 드로어 UI 완성 (664px · useCart* 연동)
- #30 뱃지 통일 (POP/LTD/temp · badge-sold 토큰화)
- #29 게이지·레이더 차트 통일
- #28 기타 공통 UI

## Session 26 (2026-04-18) — Phase 3 세팅

- PR#3 머지 → master (`024f4090`)
- `palette-experiment-v1` 브랜치 + design-polish 워크트리 생성

## Session 27 (2026-04-18) — 팔레트 Step 1 착수

**해결됨:**
- **섹션 배경 3단 로테이션** — Home 섹션별 primary/secondary/tertiary 순환 적용
- 2차 폴리시 (`9ecbb287`)
- 갤러리 14장 색상 추출 → 웜 톤 100%, 머스타드·틸·브라스 악센트 존재 확인
- 현 사이트 팔레트 갭 진단 문서화

⚠️ **Claude Design 에 "섹션 배경 3단 로테이션" 재제안 금지** — 이미 Home 에 적용됨.

## Session 29 (2026-04-19) — CTA hover gold 표준화 시작

**해결됨:**
- **CTA hover 상태: opacity:.85 → gold inset border 로 전면 교체** (`f76ca59f`)
- UI 백로그 5건 (UI-001~005) 수집
- CSS 수정 프로토콜 신설 (CLAUDE.md 반영)

⚠️ **"hover 상태 opacity 페이드" 재제안 금지** — 의도적으로 제거한 패턴.

## Session 30 (2026-04-19) — Eyebrow · 링크 gold 확장

**해결됨 (`c2d193f8`):**
- Eyebrow gold 전면 적용
- 영업시간 부분 강조
- Visit CTA 내부화
- Subscription 섹션 링크 연결
- beans-dot 재디자인

## Session 31 (2026-04-19) — Primary CTA inset 위계

- `.cta-btn:active { opacity: .7 }` 등 active 피드백은 의도적으로 유지
- primary gold 인셋 위계 실험 (커밋 `db384d02`)

## Session 32 (2026-04-19) — CTA gold 전수 확장 + 데드 코드 정리

**해결됨 (`f0fcc8d9` pushed):**
- Session 31 잔여 3px 체감 이슈 해결 — `border` 제거로 padding-box 치수 보존
- **CTA gold hover 10+ 종 전수 확장** (다크 bg → 2중 인셋, 라이트 bg outline → 단일 인셋 2px, 텍스트 링크 8종 → `border-bottom-color` gold)
- 미사용 토큰 폐기 — `--shadow-card-warm` · `--shadow-card-warm-hover`
- `.badge-sold` 하드코딩 `#8C8580` → `var(--color-badge-sold-out)` 치환
- `#pd-cart-btn:hover { opacity: .85 }` 데드 코드 삭제

⚠️ **"hover 상태에 box-shadow 추가" 재제안 금지** — 이미 표준 패턴으로 확립됨.

## 요약 — 재제안 금지 항목

| 항목 | Session | 상태 |
|------|---------|------|
| 섹션 배경 3단 로테이션 | 27 | ✅ 적용됨 |
| Eyebrow gold 전면 적용 | 30 | ✅ 적용됨 |
| CTA hover opacity 페이드 제거 | 29 | ✅ 제거 완료 |
| CTA hover gold inset | 29, 32 | ✅ 전수 확장 완료 |
| 텍스트 링크 hover gold border-bottom | 32 | ✅ 확장 완료 |
| 뱃지 토큰화 (badge-sold) | 25, 32 | ✅ 완료 |
| 게이지·레이더 차트 통일 | 25 | ✅ 완료 |
| 데드 토큰·데드 CSS 정리 | 32 | ✅ 완료 |

## 유지 결정 항목 (수정 대상 아님)

- `.cta-btn:active { opacity: .7 }` — 터치 피드백 유지
- `.footer-sns-link:hover { opacity: .9 }` — 아이콘 링크 특성상 유지
- 카트 드로어 상태 아이콘 opacity 전환
- POP/LTD/temp 뱃지 색상 — 시스템 피드백 토큰과 계열 동일 (실제 충돌 없음)

## 현재 HEAD

- 브랜치: `claude/palette-experiment-v1`
- 워크트리: `.claude/worktrees/design-polish`
- 최신 커밋: `f0fcc8d9` (pushed)
