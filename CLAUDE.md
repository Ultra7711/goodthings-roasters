# Claude Code 설정 — Good Things Roasters

## 대화 언어
항상 한국어로 대화한다. 코드·기술 용어는 영어 그대로 사용해도 무방하나, 설명과 답변은 반드시 한국어로 작성한다.

---

## 프로젝트 개요

- **작업 파일:** `goodthings_v1.0.html` — 단일 HTML 파일 SPA (CSS·JS 모두 인라인)
- **브랜치:** `claude/clever-jemison` (main: `master`)
- **서버:** `.claude/launch.json` → `goodthings` 프리뷰 서버 (포트 3333)

---

## 기술 스택

### 대구분

| 영역 | 기술 | 비고 |
|------|------|------|
| 프로토타입 | HTML 단일 파일 | 현재 단계 (`goodthings_v1.0.html`) |
| 프론트엔드 | React + Next.js + Tailwind CSS | |
| DB | Supabase (PostgreSQL) | |
| 어드민 UI | 초기: Supabase 대시보드 → 필요 시 직접 구현 | |
| 결제 | 토스페이먼츠 API | |
| 인증 | Supabase Auth | |
| 배포 | Vercel | |

### 프론트엔드 세분화

- Framework: Next.js (App Router)
- UI Primitives: Radix UI (headless)
- Styling: CSS Custom Properties (디자인 토큰 시스템 유지)
- State: Zustand or Context API
- 스타일드 라이브러리 미사용 (MUI / Mantine 등)

### 반응형 브레이크포인트

| 구간 | 브레이크포인트 | 비고 |
|------|------------|------|
| 데스크탑 | 1440px | 기준 디자인 |
| 랩탑 | 1024px | |
| 태블릿 | 768px | iPad / Android 태블릿 |
| 모바일 | 360px | Android 최소 기준, iPhone SE(375px) 커버 |

---

## 디자인 스타일 가이드

> 📄 **상세 가이드:** `docs/gtr-design-guide.md` (7파트 풀 가이드)
> 📐 **레이아웃 와이어프레임:** `docs/layout-wireframe-v2.md`
> 🎨 **비주얼 와이어프레임:** `docs/layout-wireframe-v2.html` (프리뷰 서버로 확인)

### 핵심 원칙
- **통일성 최우선** — 모든 페이지의 공통 디자인 요소는 절대적으로 통일한다.
- 공통 요소: 공통 컴포넌트, 폰트 자간, 행간, 크기, 레이아웃 등 포함.
- 예외 발생 시 예외를 허용하기보다 **수정하는 방향**을 선택한다.

### 컬러 시스템 (Warm-shifted B&W)

| 토큰 | 값 | 용도 |
|------|------|------|
| `--color-bg-primary` | `#FAFAF8` | 기본 배경 (warm white) |
| `--color-bg-inverse` | `#1C1B19` | 다크 배경 (warm black) |
| `--color-text-primary` | `#1C1B19` | 본문 텍스트 |
| `--color-text-secondary` | `#6B6963` | 보조 텍스트 |
| `--color-text-tertiary` | `#A8A49E` | 캡션·힌트 |
| `--color-text-on-dark` | `#FAFAF8` | 다크 배경 위 텍스트 |
| `--color-line-light` | `#E8E6E1` | 구분선 (라이트) |
| `--color-line-dark` | `#3A3935` | 구분선 (다크) |
| `--color-accent` | `#7A6B52` | 강조 (오크 브라운) |

### 타이포그래피

| 레벨 | 사이즈 | Weight | 용도 |
|------|--------|--------|------|
| Display | 48–64px | 300 | 히어로 헤드라인 |
| H1 | 36–40px | 300 | 페이지 타이틀 |
| H2 | 28–32px | 400 | 섹션 타이틀 |
| H3 | 20–24px | 500 | 서브 헤딩 |
| Body L | 17–18px | 400 | 강조 본문 |
| Body M | 15–16px | 400 | 기본 본문 |
| Body S | 13–14px | 400 | 캡션·보조 |
| Label | 11–12px | 500–600 | 배지·태그 |

- **한글:** Pretendard (기본) / **영문:** Inter 또는 Pretendard 라틴
- **영문 관례:** 브랜드명·고유명사만 대문자, 나머지 sentence case

### 스페이싱 스케일 (4px 기반)

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 56 · 64 · 80 · 96 · 120`

### 주요 높이값

| 요소 | Desktop | Mobile |
|------|---------|--------|
| 공지 바 | 36px | 32px |
| 헤더 | 64px | 56px |
| 히어로 | 100vh | 100svh |
| 섹션 패딩 | 120px | 80px |

### 헤더 글래스모피즘

헤더는 솔리드 배경이 아닌 **반투명 블러(글래스모피즘)** 처리하며, 스크롤 위치에 따라 라이트 ↔ 다크를 동적 전환한다.
상세 스펙은 `docs/gtr-design-guide.md` Part 3 "Header Glassmorphism" 및 `docs/layout-wireframe-v2.md` "Header" 섹션을 참조한다.

---

## 레이아웃 와이어프레임

- 와이어프레임 HTML 제작 시, **실제 화면 비율을 축소 반영**해야 한다.
- 와이어프레임 캔버스 폭과 실제 디자인 폭의 **스케일 비율을 먼저 산출**하고, 모든 섹션 높이에 동일 비율을 적용한다.
- 비율이 중요한 요소(카드, 이미지 영역 등)는 고정 px 대신 **`aspect-ratio`를 사용**하여 어떤 스케일에서든 형태가 유지되도록 한다.
- 가로 스크롤 카드 등은 **실제 보이는 카드 수**(예: 3.5장)가 와이어프레임에서도 동일하게 표현되어야 한다.

---

## 코딩 규칙

### 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 / 함수 | camelCase | `getProductList`, `isLoggedIn` |
| 컴포넌트 | PascalCase | `ProductCard`, `CheckoutForm` |
| 파일 (컴포넌트) | PascalCase.tsx | `ProductCard.tsx` |
| 파일 (유틸/훅) | camelCase.ts | `useCart.ts`, `formatPrice.ts` |
| DB 컬럼 | snake_case | `created_at`, `order_status` |
| 환경변수 | SCREAMING_SNAKE | `NEXT_PUBLIC_SUPABASE_URL` |
| CSS 변수 | kebab-case | `--color-text-primary` |

### 파일 구조 (Next.js App Router)

```
src/
  app/              # 라우트 (page.tsx, layout.tsx)
  components/       # 재사용 UI 컴포넌트
    ui/             # 범용 (Button, Input, Modal...)
    product/        # 도메인별 (ProductCard, ProductGrid...)
  lib/              # 유틸, Supabase 클라이언트, 헬퍼
  hooks/            # 커스텀 훅
  types/            # TypeScript 타입 정의
  styles/           # 글로벌 CSS, 디자인 토큰
```

### TypeScript

- strict 모드 사용
- `any` 사용 금지 — `unknown` + 타입 가드로 대체
- API 응답, DB 테이블 → 반드시 타입 정의

### 컴포넌트

- Props는 `type` 선언 (interface보다 type 선호)
- 비즈니스 로직은 커스텀 훅으로 분리, 컴포넌트는 렌더링에 집중

### 테스트

- API 엔드포인트 (Route Handlers): **필수**
- 결제·주문 로직: **필수**
- UI 컴포넌트: 선택 (크리티컬한 것만)

### 기타

- `console.log` 디버깅 코드 커밋 금지
- 환경변수는 `.env.local`에만, `.env.example`에 키 목록 유지
- 매직 넘버 금지 — 상수로 선언

---

## 수정 검증 필수 규칙 (절대 생략 금지)

> **이 규칙은 모든 CSS·JS 수정에 예외 없이 적용한다. 위반 시 사용자 시간을 낭비하게 된다.**

### 1. 수정 전 — 전수 조사
- 변경할 속성·셀렉터·변수명으로 **grep 전체 검색**을 실행한다.
- 동일 속성이 다른 셀렉터에서도 선언되어 있으면 **모두 함께 수정**한다.
- CSS 특정성(specificity) 충돌 가능성을 반드시 확인한다.

### 2. 수정 후 — computed value 검증
- 브라우저에서 **inspect로 해당 요소의 computed style**을 확인한다.
- 변경한 속성의 값이 기대값과 **정확히 일치하는지** 대조한다.
- 스크린샷만으로 "됐습니다" 보고하지 않는다. 반드시 수치로 확인한다.

### 3. 불일치 시 — 즉시 원인 추적
- computed value가 변경 전과 같으면 **"됐습니다" 금지**.
- 다른 셀렉터 충돌, 캐시 문제, 숏핸드 덮어쓰기 등 원인을 즉시 추적한다.
- 원인을 찾아 해결한 뒤 다시 검증한다.

### 4. 스크린샷 사용 기준
- 레이아웃·전체 비주얼 확인이 필요할 때만 스크린샷을 사용한다.
- 단순 속성 변경(색상, 크기, 폰트 등)은 **inspect 검증만으로 완료**한다.
- 스크린샷을 찍었으면 **눈으로 변경 지점을 반드시 확인**한다.

---

## 핵심 아키텍처 패턴 (프로토타입)

### 서브 페이지 구조
모든 서브 페이지는 `position:fixed;inset:0;overflow-y:auto` + flex column 레이아웃.
```
<div id="xxx-page" class="sub-page">
  <div id="xxx-ann-wrap"><div class="ann">…</div></div>
  <div id="xxx-hdr-wrap" class="sub-hdr-wrap blk"></div>
  <div id="xxx-body">…</div>
</div>
```

### 서브 페이지 열기 필수 패턴
1. `closeOverlay()` 선제 호출
2. 형제 서브 페이지 닫기 (각 `openXxxPage` 함수 내 명시적으로)
3. `bringPageToFront(page)` — z-index 동적 관리
4. `page.classList.add('open')`
5. `document.body.style.overflow='hidden'`

### 서브 페이지 닫기 필수 패턴 3종
```javascript
closeOverlay();
_restoreOverflow();   // body overflow 직접 해제 금지 — 반드시 이 함수 사용
window.scrollTo({top:0,behavior:'instant'});
resetHeroVideo();
```

### body overflow 관리
- `document.body.style.overflow='hidden'` — 서브 페이지 열 때
- **직접 `''`로 해제 금지** — `_restoreOverflow()` 반드시 사용 (다른 페이지가 열려 있으면 hidden 유지)

### 서브 페이지 상태 관리 (아코디언/폼 포함 시)
1. **재진입 초기화** — `_resetXxxState()`: `openXxxPage()` 내부에서 `bringPageToFront` 전에 호출. 아코디언 닫기 + 편집 버튼 레이블 복원 + 폼 리셋.
2. **필수 필드 검증** — CTA 클릭 시 빈 필수 필드에 warn 표시, 오류 있으면 폼 닫지 않음. 형식 오류(기존 warn)도 함께 확인.
3. **취소 시 폼 리셋** — `_resetXxxForm()`: 입력값 초기화 + `dispatchEvent(new Event('input'))` 로 helper 연동 리셋 + warn 해제.

---

## 검색 오버레이 (`openOverlay`) 패턴

### 헤더 측정 — 최상위 페이지 기준
여러 서브 페이지가 동시에 `open` 상태일 수 있으므로, **z-index가 가장 높은(= `bringPageToFront`로 활성화된)** 페이지의 헤더를 사용:
```javascript
const openSubPages=[...document.querySelectorAll('.sub-page.open')];
const topSubPage=openSubPages.length
  ?openSubPages.reduce((a,b)=>(parseInt(a.style.zIndex)||0)>=(parseInt(b.style.zIndex)||0)?a:b)
  :null;
const activeSubHdr=topSubPage?topSubPage.querySelector('.sub-hdr-wrap'):null;
const refHdr=activeSubHdr||document.getElementById('site-hdr-wrap');
```
> ⚠️ `document.querySelector('.sub-page.open .sub-hdr-wrap')` (DOM 순서 기준) 사용 금지 — 숨겨진 페이지 헤더가 먼저 선택되는 버그 발생.

### 주의: 복수 페이지 open 케이스
`openCafeMenuPage`는 `product-detail-page`·`login-page`를 닫지 않으므로, 상품 상세 → 메뉴 페이지 이동 시 두 페이지가 동시에 open 상태가 됨. `openOverlay`에서 z-index 기준 선택으로 대응.

---

## 헤더 구분선 규칙 (`.has-panel` 패턴)

| 상태 | 처리 |
|------|------|
| 헤더 단독 | `.sub-hdr-wrap` → `border-bottom: 1px solid rgba(0,0,0,.04)` (풀 width) |
| 헤더 + 검색 패널 | `.sub-hdr-wrap.has-panel` → `border-bottom:none` + `::after` 인셋 선 |
| SRP 헤더 (항상 패널) | `#srp-hdr-wrap` → 항상 `::after` 인셋 선 |

```css
.sub-hdr-wrap.has-panel, #srp-hdr-wrap { border-bottom: none; }
.sub-hdr-wrap.has-panel::after, #srp-hdr-wrap::after {
  content:''; position:absolute; bottom:0;
  left:var(--search-panel-padding-x); right:var(--search-panel-padding-x);
  height:1px; background:rgba(0,0,0,.06);
}
```

`openOverlay()` 호출 시 `refHdr.classList.add('has-panel')`, `closeOverlay()` 시 제거.

---

## 폼 인풋 필드 규칙
신규 폼 제작 시 자동 적용:
- 헬퍼 텍스트 (`.input-helper`) 통일
- 전화번호 필드 자동 하이픈 (`formatPhoneNumber()`)
- Enter 키 다음 필드 이동 네비게이션

---

## 개발 도구
- **DEV 패널** (`⌘ DEV` 버튼): 접근 불가 페이지 바로가기. **새 서브 페이지 추가 시 DEV 패널에 항상 등록.**
- **`_restoreOverflow()`**: 모든 서브 페이지의 open 여부를 확인 후 body overflow 결정.

---

## 검색 시스템
- 4레이어: 정규화 → 동의어(`SEARCH_SYNONYMS`) → 발음(`_srchL2`) → 초성(`_srchL3`)
- `_srchL3` NFC 재조합 필수 (`normalize('NFC')`) — NFD substring 오매칭 방지
- `CAT_LABEL` 맵으로 카테고리 한글명 초성 검색 지원
- 동의어: 원두↔커피빈↔coffee bean, 드립백↔drip bag 등 양방향 연결

### 단일 음절 쿼리 규칙
- 단일 한국어 음절 쿼리(예: 티, 콩)는 **상품명·카테고리만** 검색 대상으로 제한 (desc·specs 제외)
- Layer 3 정규화(ㅌ→ㄷ 등 거센소리→평음 변환)도 단일 음절 시 적용하지 않음
- 이유: 단음절은 긴 설명문에서 무관한 단어 내 substring으로 오매칭 발생 빈도가 높음
  (예: "티" → 퀄리**티**, 스페셜**티**, 바**디**감 등)

---

## 핸드오버 메모리 작성 규칙

> 상세 규칙: `docs/handover-memory-rule.md`

세션 경계(페이즈 완료·도메인 전환·컨텍스트 리셋 직전)에 다음 세션이 즉시 복귀할 수 있도록
`memory/project_*_complete.md` 또는 `memory/session_handover_*.md` 를 작성한다.
**이 문서는 git 저장소에 영구 보관**되므로 Claude Desktop 재설치·설정 초기화 후에도 유효하다.

### 자동 트리거 3종 (명시적 요청 없이 실행)

1. **페이즈·RP 완료 커밋 + 푸시 직후** — `project_pixel_port_rp{N}_handover.md`
2. **세션 리셋·`/clear` 직전** — `session_handover_{YYYY_MM_DD}.md`
3. **Compaction 3회 이상 + 클린 커밋 경계** — `project_session{N}_complete.md`

### 핵심 원칙

- **7섹션 필수:** frontmatter → 완료 내용 → Deferred → 결과 문서 포인터 → 진입 컨텍스트 → 영구 원칙 → 다음 첫 단계
- **결과 문서 포인터 원칙:** handover 메모리 하나만 읽으면 모든 관련 문서 위치를 알 수 있어야 한다. 경로 추측 금지.
- **체인 유지:** 섹션 4에 이전 핸드오버 메모리 링크 포함 (N-1 → N → N+1 추적 가능)
- **커밋 후 작성:** 먼저 커밋·푸시 → 해시 확인 → 메모리 작성 순서 준수
- **MEMORY.md 인덱스 동시 등록** 필수
