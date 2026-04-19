---
title: Claude Design 2차 실험 프롬프트 (하드 제약 포함)
created: 2026-04-19
supersedes: claude-design-handoff.md (1차, Session 22)
---

# Claude Design 2차 실험 프롬프트

아래 프롬프트를 **그대로 복사** 하여 Claude Design 에 붙여넣기. 첨부 파일은 본 디렉터리(`docs/design-baseline/`) 의 다음 항목:

- `01-screenshots-session33/*.png` (14장)
- `02-tokens.css`
- `03-consumer-map.md`
- `04-section-structure.md`
- `05-component-inventory.md`
- `06-prototype-vs-current.md`
- `08-changes-since-session22.md`
- `09-round2-scope-gate.md`

## 프롬프트 본문 (복사용)

```
프로젝트: Good Things Roasters — 스페셜티 커피 커머스 (Next.js + Tailwind + CSS Custom Properties)
목적: 현재 웜-시프트 B&W 팔레트의 **2차 미세 조정** 후보 제시. 전수 적용 여부를 내부 검토.

이전 실험(Session 22) 이 다음 사유로 실패했으며, **재발 방지**가 이번 실험의 최우선 제약:

F1. 존재하지 않는 토큰 참조 — `--color-btn-primary-bg-hover` 소비자 0건을 모르고 제안
F2. 가공 컴포넌트 참조 — `LimitedBadge` 컴포넌트는 존재하지 않음 (실제는 CSS 클래스 .badge-*)
F3. 섹션 구조 오해 — 섹션은 `margin` 기반이나 `padding` 기준으로 제안
F4. 1.5% gap 인지 실패 — primary↔secondary 차이를 "동일하다" 로 처리
F5. 프로토타입(goodthings_v1.0.html) 을 현행으로 오인

## 하드 제약

1. 첨부된 `02-tokens.css` 에 정의된 변수만 사용할 것. 신규 변수 제안 시 "신규" 명시 + 사유 서술
2. 첨부된 `05-component-inventory.md` 에 없는 컴포넌트 이름 사용 금지
3. 첨부된 `08-changes-since-session22.md` 의 "재제안 금지 항목" 은 언급 · 제안 금지
4. 첨부된 `06-prototype-vs-current.md` — 프로토타입 HTML 참조 금지
5. 첨부된 `09-round2-scope-gate.md` 의 "배제" 항목 준수

## 허용 범위 (스코프)

A. 팔레트 톤 미세 조정
   - `--color-background-primary/secondary/tertiary` 웜 톤 값
   - `--color-accent-gold` 톤 값
   - 다크 bg inverse 의 warm black chroma
B. 보조 악센트 후보 제안 (번트오렌지·틸·머스타드 등, 도입 여부는 별도)
C. 현 3단 로테이션 로직 유지 전제에서 각 단계 값만

## 제공 자료

- 14개 페이지 스크린샷 (1440x900, retina 2x) — `01-screenshots-session33/`
- 전체 토큰 정의 (`02-tokens.css`)
- 토큰 소비자 맵 (`03-consumer-map.md`) — UNUSED / 사용처 명시
- 섹션 구조 측정 (`04-section-structure.md`)
- 컴포넌트 인벤토리 (`05-component-inventory.md`)
- Session 22 이후 해결된 이슈 타임라인 (`08-changes-since-session22.md`)
- 채택 게이트 기준 (`09-round2-scope-gate.md`)

## 기대 출력 형식

1. **변경 제안 토큰 목록** (최대 10개) — 변수명 · 현 값 · 제안 값 · 변경 사유
2. **각 페이지 사이드바이사이드 프리뷰** — 현재 vs 제안 (최소 4페이지: Home · Story · Shop · PDP)
3. **정합성 체크리스트** — 각 하드 제약을 통과했는지 자체 확인

## 금지 출력

- 새 컴포넌트 구조 제안
- 타이포 · 스페이싱 토큰 변경
- 프로토타입 기반 전면 재디자인
- "A안/B안/C안" 식 광범위한 방향성 대안 (미세 조정 1세트만)
```

## 사용 후 처리

채택 여부는 `09-round2-scope-gate.md` 의 Gate 1/2/3 순차 평가.

Gate 통과 시 → 해당 토큰만 `globals.css` 에 swap → 단일 커밋 `style(palette): Claude Design round-2 (#32)` → 시각 회귀 확인.
