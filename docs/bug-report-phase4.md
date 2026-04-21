# GTR 버그 리포트 — Phase 4 이후

> 프로덕션 배포(`goodthings-roasters.vercel.app`) 이후 발견된 버그·UX 이슈를 누적 기록. 일정 개수 누적 시 일괄 해결 세션 진행.
>
> **최종 업데이트:** 2026-04-21

---

## 범례

| 기호 | 의미 |
|------|------|
| 🔴 | Critical — 결제/인증/데이터 손상 |
| 🟠 | High — 핵심 기능 오동작 |
| 🟡 | Medium — UX 저하·시각 결함 |
| 🟢 | Low — 코스메틱·엣지 케이스 |
| ✅ | 해결 완료 |

---

## 열린 버그

### BUG-101 — 첫 진입 시 버튼 호버 연출이 전 버튼에서 발동 🟡

- **발견:** 2026-04-21 / prod
- **재현 경로:** 메인 진입 → 스크롤로 섹션 인터랙션 트리거
- **실제:** 첫 입장 때 페이지 내 모든 버튼의 호버 연출이 순간 발동. 이후엔 정상 (호버 시에만 발동)
- **추정 범위:** CSS transition 초기값 · `transition: all` 또는 hover 상태가 mount 시 한번 적용되는 케이스. `:hover` 가 아닌 `.is-hovering` 클래스 또는 `will-change` 초기 페인트 이슈 가능성.

### BUG-102 — 상품 안내 아코디언 내용이 우측으로 오버플로우·잘림 🟠

- **발견:** 2026-04-21
- **재현 경로:** 상품상세 페이지 → 아코디언 섹션 확장
- **실제:** 내용이 컨테이너 우측 화면 바깥으로 넘침 · 잘림
- **추정 범위:** `ProductDetail` 아코디언 — `overflow-x` · `width: 100%` 누락 또는 `white-space: nowrap` 잔존. Session 47~48 레시피 카드 반응형 이후 회귀 가능성.

### BUG-103 — 인풋필드 헤어라인이 iOS 모바일에서 안 보임 🟡

- **발견:** 2026-04-21 / iOS Safari·Chrome
- **실제:** PC 정상 · iOS 모바일에서 헤어라인 불가시
- **추정 범위:** `border: 1px solid var(--color-line-light)` 가 iOS 고DPR 에서 sub-pixel rendering 으로 사라짐. `0.5px` · `hairline` 토큰 도입 또는 `box-shadow: inset 0 0 0 1px` 대체 검토.

### BUG-104 — ✅ 카페 메뉴 바텀시트 하단 세이프티 에리어 iOS 잘림 (흰색)

- **발견:** 2026-04-21 / iOS
- **재현 경로:** 카페 메뉴 → 상품 탭 → 바텀시트 오픈
- **실제:** 하단 safe-area inset 영역이 바텀시트 배경으로 채워지지 않고 화이트 노출
- **추정 범위:** 바텀시트 컨테이너 `padding-bottom: env(safe-area-inset-bottom)` 가 배경 밖에 적용. `padding` 대신 `min-height` + 내부 `padding` 또는 배경 확장 필요.

### BUG-105 — 모바일 Chrome 하단 네비 영역이 히어로와 충돌 🟠

- **발견:** 2026-04-21 / Android·iOS Chrome
- **재현 경로:** 메인 첫 진입 (히어로 화면)
- **실제:**
  1. 브라우저 하단 네비가 히어로 `100vh` 를 깎음 → 하단에 흰 띠(시즌배너 배경) 노출
  2. 스크롤 중 네비가 사라지면 히어로가 순간 확장
- **추정 범위:** `100vh` → `100svh`/`100dvh` 전환 필요. 또는 JS 로 `--hero-h` 변수 관리. (CLAUDE.md 에 `100svh` 언급 있으나 반영 누락 가능성)

### BUG-106 — iOS Chrome 자동완성 푸른색 배경 노출 🟢

- **발견:** 2026-04-21 / iOS Chrome
- **실제:** 인풋필드 자동완성 시 iOS Chrome 네이티브 푸른 배경색 노출 (디자인 토큰 무시)
- **추정 범위:** `-webkit-autofill` 대응 CSS 누락. `-webkit-box-shadow: 0 0 0 1000px var(--color-bg-primary) inset` + `-webkit-text-fill-color` 로 오버라이드.

### BUG-107 — 모바일 굿데이즈 라이트박스 좌우 버튼 크기·컬러 보정 🟢

- **발견:** 2026-04-21 / 모바일
- **재현 경로:** 굿데이즈 → 이미지 클릭 → 라이트박스
- **실제:** 좌우 스크롤 버튼이 계속 보이고, 기본 회색이 탁함. 크기도 모바일에선 크거나 어색
- **개선 제안:** 크기 조정 + `opacity` 활용 반투명 + 호버/탭 시에만 강조 (idle 시 흐리게)

### BUG-108 — ✅ 카페 메뉴 바텀시트 터치 이벤트 통과 (배경 스크롤)

- **발견:** 2026-04-21 / 모바일
- **재현 경로:** 카페 메뉴 → 상품 탭 → 바텀시트 오픈 → 바텀시트 영역 터치/스크롤
- **실제:** 바텀시트가 터치를 소비하지 못하고 하단 리스트가 대신 스크롤됨. 핸들러(드래그) 도 미동작.
- **추정 범위:** `pointer-events` 누락 또는 `touch-action` 미설정. 오버레이/바디 스크롤 락 (`overflow:hidden` on body) 미적용 가능성. `useDrawer` 패턴과 일관성 검토 필요.

---

## 해결됨

### BUG-105 — 모바일 Chrome 하단 네비 영역이 히어로와 충돌 ✅

- **해결:** 2026-04-21
- **방법:** `HeroSection` height `100vh` → `100svh` 전환으로 모바일 브라우저 UI 영역 제외. 오버스크롤 배경색 시스템(OverscrollColor + OverscrollTop) 도입으로 상단 흰 배경 노출 문제도 동시 해결.
- **커밋:** `2d4d59f5` (Session 53)

### BUG-108 — 카페 메뉴 바텀시트 터치 이벤트 통과 (배경 스크롤) ✅

- **해결:** 2026-04-21
- **방법:** `overscroll-behavior:contain` + `touch-action:pan-y`(CSS), `#cns-bg` touchmove preventDefault(JS), 모바일 드래그-닫기 80px 스와이프 제스처 추가(JS).
- **커밋:** `4cc1bca2` (Session 53)

### BUG-104 — 카페 메뉴 바텀시트 하단 세이프티 에리어 iOS 잘림 (흰색) ✅

- **해결:** 2026-04-21
- **방법:** `overflow-y:auto` 컨테이너의 `padding-bottom` 배경 미채움 quirk 해소. panel `padding-bottom` 제거 → `.cns-content`에 `calc(32px + env(safe-area-inset-bottom))` 적용.
- **커밋:** `e9d3ed8f` (Session 53)

---

## 리포트 템플릿

```
### BUG-XXX — {한 줄 요약} {🔴|🟠|🟡|🟢}

- **발견:** 2026-MM-DD / {환경: prod / dev / 특정 브라우저}
- **재현 경로:** {URL · 클릭 시퀀스}
- **기대:** {어떻게 되어야 하는가}
- **실제:** {어떻게 되고 있는가}
- **스크린샷/로그:** {있으면 첨부}
- **추정 범위:** {해당하는 경우}
```
