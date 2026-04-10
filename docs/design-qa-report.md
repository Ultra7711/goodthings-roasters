# Design QA Report — Token Consistency Audit

> **프로젝트:** Good Things Roasters  
> **대상 파일:** `goodthings_v1.0.html`  
> **수행일:** 2026-04-09  
> **수행 방식:** 코드 레벨 자동 스캔 + 브라우저 비주얼 검증

---

## 1. 요약

CSS 하드코딩 값을 디자인 토큰(CSS Custom Properties)으로 전환하는 일관성 감사를 수행했다.  
총 **~250건**의 하드코딩 값을 토큰으로 치환하고, 11개의 letter-spacing 토큰을 신설했다.

| 구분 | 상태 |
|------|------|
| 컬러 토큰 일관성 | ✅ 완료 |
| 피드백 컬러 토큰 | ✅ 완료 |
| 타이포그래피 (font-size) | ✅ 완료 |
| letter-spacing 토큰 | ✅ 완료 (신설 포함) |
| font-weight | ⏭️ 건너뜀 (표준값으로 충분) |
| motion/easing 토큰 | ✅ 완료 (매칭 가능 항목만) |
| 비주얼 검증 | ✅ 완료 (10개 페이지) |

---

## 2. 상세 내역

### 2-1. 컬러 토큰 (~100건)

**배경색**
- `#FAFAF8` → `var(--color-background-primary)`
- `#1C1B19` (배경 용도) → `var(--color-background-inverse)`

**텍스트색**
- `#1C1B19` (텍스트 용도) → `var(--color-text-primary)`
- `#FAFAF8` (다크 배경 위) → `var(--color-text-inverse)`

**버튼**
- `#1C1B19` (버튼 배경) → `var(--color-btn-primary-bg)`

**신설 토큰**
- `--color-background-inverse: #1C1B19` — 다크 배경 전용 (공지바, 푸터, 히어로 등)

**잔여 하드코딩 (의도적 유지)**
- SVG `fill` / `stroke` 속성 — CSS 변수 사용 불가
- JS 런타임 스타일 직접 설정 — CSS 변수 컨텍스트 제한

### 2-2. 피드백 컬러 (~12건)

| 하드코딩 | 토큰 |
|----------|------|
| `#C4554E` | `var(--color-error)` |
| `#5C7A4B` | `var(--color-success)` |
| `#B8943F` | `var(--color-warning)` |
| `#4A6B8A` | `var(--color-info)` |

### 2-3. font-size (9건)

타이포그래피 스케일 토큰(`--type-*-size`)으로 치환.  
이미 대부분 토큰화되어 있었으며, 잔여 하드코딩 9건을 처리.

### 2-4. letter-spacing (~110건)

**신설 토큰 11개:**

| 토큰 | 값 | 용도 |
|------|------|------|
| `--ls-display` | `-.02em` | Display, 가격, 페이지 타이틀 |
| `--ls-heading` | `-.01em` | H2, H3, 섹션 타이틀 |
| `--ls-neutral` | `0` | 탭, 기본 |
| `--ls-body-s` | `.01em` | 섬세한 본문, 서브 텍스트 |
| `--ls-body` | `.02em` | 이름, 일반 본문 |
| `--ls-nav` | `.03em` | 네비게이션 링크 |
| `--ls-button` | `.04em` | 버튼, 공지바, CTA |
| `--ls-step` | `.05em` | 스텝 넘버 |
| `--ls-uppercase` | `.06em` | 대문자 링크, 카테고리 |
| `--ls-label` | `.08em` | 대문자 라벨 (섹션, 푸터) |
| `--ls-label-wide` | `.1em` | 팝업 라벨, 최대 간격 |

- `.07em` (1건) → `.06em` (`--ls-uppercase`)으로 통합
- 기존 컴포넌트 토큰(`--btn-letter-spacing` 등 8개)도 새 토큰을 참조하도록 업데이트

**치환 후 하드코딩 잔여: 0건**

### 2-5. font-weight — 건너뜀

- 215건, 4개 값 (300/400/500/600)
- CSS 표준 weight 명칭과 1:1 대응하여 가독성 충분
- 타이포 스케일 토큰에 이미 weight 포함 (`--type-h1-weight` 등)
- 과잉 토큰화로 판단하여 생략

### 2-6. motion/easing (19건)

| 하드코딩 | 토큰 | 건수 |
|----------|------|------|
| `700ms ease` | `var(--duration-slide) ease` | 8 |
| `.7s ease-out` | `var(--duration-slide) ease-out` | 9 |
| `.35s ease` (아코디언) | `var(--duration-drawer) ease` | 2 |

**의도적 유지 항목:**
- `1.2s cubic-bezier(.25,.1,.25,1)` — 이미지 줌, 고유 커브
- `0.9s ease-out` — 스크롤 리빌, 기존 토큰과 불일치 (600ms vs 900ms)
- `.5s`~`.55s` — 스프링 애니메이션, 맥락 특화 타이밍
- `.15s` / `150ms` — 마이크로 피드백, 고유 속도감

---

## 3. 비주얼 검증 결과

10개 주요 페이지/섹션에서 스크린샷 검증 수행. 전량 정상.

| 페이지 | 상태 |
|--------|------|
| 메인 — 히어로 | ✅ |
| 메인 — 시즌 프로모션 | ✅ |
| 메인 — Our Story (다크 배경) | ✅ |
| 메인 — Featured Beans | ✅ |
| 메인 — Good Days 갤러리 | ✅ |
| 메인 — 푸터 (다크 배경) | ✅ |
| Shop 페이지 | ✅ |
| 로그인 페이지 | ✅ |
| 상품 상세 페이지 | ✅ |
| 카페 메뉴 페이지 | ✅ |

---

## 4. 현재 토큰 커버리지

| 카테고리 | 토큰화 수준 |
|----------|------------|
| 컬러 (배경/텍스트/버튼/피드백) | ●●●●○ 높음 — SVG/JS 런타임 제외 전량 |
| 타이포 (font-size) | ●●●●● 완료 |
| 타이포 (font-weight) | ●●●○○ 부분 — 스케일 토큰만, 개별 선언은 하드코딩 유지 |
| letter-spacing | ●●●●● 완료 |
| line-height | ●●●○○ 부분 — 토큰 존재, 일부 하드코딩 잔여 |
| motion/easing | ●●●○○ 부분 — 매칭 가능 항목만, 고유 타이밍 유지 |
| z-index | ●●●●○ 높음 — 토큰 선언 완료, 대부분 적용 |
| spacing | ●●○○○ 낮음 — 토큰 미도입, margin/padding 하드코딩 |

---

## 5. 향후 권장사항

1. **spacing 토큰 도입** — 4px 기반 스케일(`--space-1: 4px` ~ `--space-30: 120px`)을 신설하면 간격 일관성 향상. 단, 건수가 매우 많아 Next.js 전환 시 Tailwind spacing과 통합하는 것이 효율적.
2. **line-height 잔여 하드코딩 정리** — 기존 토큰(`--lh-tight/snug/normal/relaxed`) 활용도를 높일 수 있음.
3. **Next.js 전환 시 Tailwind 매핑** — 현재 CSS Custom Properties를 `tailwind.config.ts`의 `theme.extend`에 그대로 연결하면 토큰 체계를 유지하면서 유틸리티 클래스 사용 가능.
