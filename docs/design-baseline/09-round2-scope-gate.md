---
title: 2차 실험 스코프 & 채택 게이트
created: 2026-04-19
session: 33
purpose: 전수 적용 여부 결정 기준
---

# 2차 실험 스코프 & 채택 게이트

> **최종 목표:** Claude Design 2차 결과가 **현 사이트에 전수 적용할 만한 품질** 인지 결정. 부분 채택 가능.

## 스코프

### A. 팔레트 톤 재검토 (허용)

현재 토큰 시스템 전제에서 **색 값만** 조정:
- `--color-background-*` primary/secondary/tertiary 웜 톤 미세 조정 가능
- `--color-accent-gold` 톤 변주 가능
- 번트오렌지·틸·머스타드 등 **보조 악센트** 후보 제안 가능 (도입 여부는 별도 결정)

### B. 3단 로테이션 미세 보정 (조건부 허용)

Session 27 에 적용된 3단 로테이션 **로직 자체는 유지**. 다만 각 단계 톤 값만 허용.

⚠️ "로테이션 폐지" · "2단으로 축소" 제안은 제외.

### C. 다크 섹션 (RoasterySection · Footer) 톤 검토 (허용)

- 현: `--color-background-inverse #1C1B19`
- 검토 가능: warm black 의 LAB 공간에서 chroma 추가 (예: +0.5~1.0)

### D. CTA · 링크 gold 상세 조정 (제한적 허용)

Session 29/32 에서 gold inset 표준 확립. **패턴 변경 금지**. `--color-accent-gold` 값만 톤 조정 가능.

### E. 배제 (out of scope)

- ❌ 컴포넌트 구조 · DOM 변경
- ❌ 타이포그래피 · 스페이싱 토큰 변경
- ❌ 뱃지 시스템 재설계
- ❌ 게이지·레이더 차트 재디자인
- ❌ 새 컴포넌트 제안 (가공 컴포넌트 참조 = F2 재발)
- ❌ 프로토타입 `goodthings_v1.0.html` 기반 제안 (F5 재발)

## 채택 게이트

### Gate 1 — 정합성 (Pass 필수)

- [ ] 제안된 모든 토큰이 `02-tokens.css` 에 존재하는 변수만 참조
- [ ] 가공 컴포넌트 이름 (예: LimitedBadge) 없음
- [ ] 프로토타입 HTML 참조 없음
- [ ] 08 문서의 "재제안 금지 항목" 없음

Gate 1 실패 시 → **즉시 폐기**, 재제출 불필요.

### Gate 2 — 시각 품질 (주관 평가)

- [ ] 3단 로테이션이 1.5%+ 지각 가능한 차이 (F4 회피)
- [ ] 다크 섹션과 라이트 섹션의 대비 정합
- [ ] CTA gold inset 가독성 유지
- [ ] PDP 게이지·레이더 프레임 색 호환

### Gate 3 — 적용 리스크 (기술 평가)

- [ ] 변경 토큰 수 ≤ 10 (롤백 용이성)
- [ ] `npx next build` 영향 예측 가능
- [ ] 다크 bg 대비 WCAG AA ≥ 4.5:1 유지

## 채택 시 실행 순서

1. 채택 토큰만 추출 → `globals.css` `@theme`/`:root` 해당 변수 교체
2. 단일 커밋: `style(palette): Claude Design round-2 전수 적용 (#32)`
3. `npx next build` + `npx tsc --noEmit` + `npx eslint` 전부 통과
4. 전체 페이지 시각 회귀 확인 (14장 재캡처 · diff)
5. 실패 시 1커밋 단위로 `git revert`

## 채택 반려 시

- Gate 1 실패 → 실험 자체 종료. 현행 유지.
- Gate 2 실패 → 부분 채택 검토 (1~2 토큰)
- Gate 3 실패 → 보류, Step 4 (글로벌 토큰 재조정) 단계로 이관

## 리소스 제약

- Claude Design 사용량 46% 소진 (2026-04-19 기준, 4일 후 리셋)
- 2차 실험 착수는 **주간 리셋 이후** 권장
- 준비 작업 (본 문서 패키지) 은 Claude Design 할당 0%
