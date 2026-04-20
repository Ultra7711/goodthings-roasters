---
title: 프로토타입 vs 현 구현 (F5 방지 — goodthings_v1.0.html 을 현행으로 오인 차단)
created: 2026-04-19
---

# 프로토타입 vs 현 구현

> **목적:** Session 22 실패 F5 — `goodthings_v1.0.html` 단일 HTML 프로토타입을 현행으로 간주하고 제안.
> 프로토타입은 **초기 시각 참조용** 이며, 현 구현은 Next.js App Router + 컴포넌트 분리.

## ⚠️ 중요 경고

**`goodthings_v1.0.html` 는 레거시 프로토타입입니다.**

- 위치: 리포 루트 `goodthings_v1.0.html`
- 성격: 단일 HTML SPA (CSS/JS 인라인)
- 상태: **제안 소스로 사용 금지**
- 현행: `next/` 디렉터리 (Next.js App Router)

## 비교표

| 영역 | goodthings_v1.0.html (구) | next/ (현) |
|------|--------------------------|-----------|
| 구조 | 단일 파일 SPA | Next.js App Router |
| 라우팅 | JS 기반 서브 페이지 토글 | 파일 기반 라우팅 |
| CSS | 인라인 + 전역 | `globals.css` + 토큰 시스템 |
| 컴포넌트 | 없음 (DOM 직접 조작) | React 컴포넌트 분리 |
| 상태 | DOM class · style | Zustand 제거 · Supabase · React state |
| 뱃지 | 클래스 기반 | 동일 (CSS 클래스) |
| 히어로 | 비디오 bg | 동일 |
| 섹션 로테이션 | 없음 | 3단 (Session 27) |
| CTA hover | `opacity:.85` | gold inset (Session 29/32) ✅ |

## 프로토타입만의 잔존 요소 (참조 금지)

- **deprecated CSS 클래스** — 프로토타입엔 남아있으나 Next.js 이식에서 사용 안 함
- **인라인 이벤트 핸들러** — `onclick="..."` 등
- **전역 유틸 함수** — `_restoreOverflow()` 같은 함수는 Next.js 훅으로 대체됨

## 참고 시 허용되는 부분

- **시각 스타일 방향** (warm-shifted B&W)
- **타이포그래피 스케일** (CLAUDE.md 에 토큰화됨)
- **섹션 순서 · 정보 아키텍처**

그 외의 DOM 구조·CSS 수치·인터랙션은 **반드시 `next/src/` 를 ground truth 로 사용**.

## Claude Design 사용 지침

1. 스크린샷은 `01-screenshots-session33/*.png` 만 사용 — 프로토타입 캡처 금지
2. 토큰 소스는 `02-tokens.css` — 프로토타입 인라인 CSS 금지
3. 컴포넌트 이름은 `05-component-inventory.md` — 가공 컴포넌트 생성 금지
4. 섹션 구조는 `04-section-structure.md` — 프로토타입 DOM 참조 금지

## 공식 가이드 참조 순서

1. **CLAUDE.md** (루트) — 디자인 시스템 + 코딩 규칙
2. **`docs/gtr-design-guide.md`** — 7파트 디자인 가이드
3. **`docs/layout-wireframe-v2.md`** — 레이아웃 와이어프레임
4. 본 `docs/design-baseline/*` — Claude Design 2차 실험용

프로토타입은 위 4단계 어디에도 포함되지 않음.
