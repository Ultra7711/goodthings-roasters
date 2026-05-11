# Claude Code 설정 — Good Things Roasters

## 대화 언어
항상 한국어로 대화한다. 코드·기술 용어는 영어 그대로 사용해도 무방하나, 설명과 답변은 반드시 한국어로 작성한다.

---

## Agent skills

mattpocock-skills 의 engineering skill (`diagnose`, `improve-codebase-architecture`, `tdd`, `zoom-out`, `grill-with-docs`) 사용 시 다음 docs 참조.

### Issue tracker

**미사용** — master 직 push 환경. issue 기반 workflow 대신 `memory/project_*_plan.md` (carry-over) 와 `project_session*_complete.md` (세션 스냅샷) 사용. `to-issues` / `to-prd` / `triage` 스킬 미도입.

### Triage labels

**미사용** — issue 자체 안 씀.

### Domain docs

**Single-context.** `CONTEXT.md` (root) + `docs/adr/` + GTR 특화로 `memory/feedback_*.md` / `memory/project_*.md`. 자세한 layout + 소비 규칙은 `docs/agents/domain.md` 참조.

---

## 프로젝트 개요

- **작업 디렉토리:** `next/` (Next.js App Router)
- **브랜치:** `master`

---

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | React + Next.js (App Router) | |
| DB | Supabase (PostgreSQL) | |
| 어드민 UI | 직접 구현 (Next.js + shadcn/ui · `/admin/login` 별도) | `docs/admin-implementation-plan.md` |
| 어드민 이미지 업로드 | Supabase Storage (`product-images` · `menu-images` 버킷) | `is_admin()` RLS 재사용 |
| 결제 | 토스페이먼츠 API | |
| 인증 | Supabase Auth | |
| 배포 | Vercel | |

### 프론트엔드 세분화

- Framework: Next.js (App Router)
- UI Primitives: Radix UI (headless)
- Styling: CSS Custom Properties (디자인 토큰 시스템)
- State: Zustand or Context API
- 스타일드 라이브러리 미사용 (MUI / Mantine 등)

### 반응형 브레이크포인트

> 🚨 **모든 페이지·섹션 = 1440 데스크탑 기준 제작·검증.**
> max-width 1440 정합 필수. 검증 순서: ① 1440 → ② 1024 → ③ 768 → ④ 360.
> 1440 검증 없이 다른 해상도부터 검증·보고 금지.

| 구간 | 브레이크포인트 | 비고 |
|------|------------|------|
| 데스크탑 | 1440px | **기준 디자인 (제작·검증 baseline)** |
| 랩탑 | 1024px | |
| 태블릿 | 768px | iPad / Android 태블릿 |
| 모바일 | 360px | Android 최소 기준, iPhone SE(375px) 커버 |

---

## 디자인 스타일 가이드

> 📄 **상세 가이드:** `docs/gtr-design-guide.md` (7파트 풀 가이드)
> 📐 **레이아웃 와이어프레임:** `docs/layout-wireframe-v2.md`

### 핵심 원칙
- **통일성 최우선** — 모든 페이지의 공통 디자인 요소는 절대적으로 통일한다.
- 예외 발생 시 예외를 허용하기보다 **수정하는 방향**을 선택한다.

### 컬러 시스템 (Warm-shifted B&W)

> ⚠️ **토큰 사용 전 `next/src/app/globals.css` 의 `:root` 블록 grep 필수** — globals.css 가 진짜 source of truth.
> 카테고리별 토큰 표: `docs/gtr-design-guide.md` **Part 1 Color System** 참조.
> 신규 토큰 추가 시: globals.css 정의 → docs/gtr-design-guide.md 갱신 (drift 차단).

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

헤더는 **반투명 블러(글래스모피즘)** 처리하며, 스크롤 위치에 따라 라이트 ↔ 다크를 동적 전환한다.
상세 스펙: `docs/gtr-design-guide.md` Part 3 "Header Glassmorphism"

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
- **신규 모달/드로어/시트 작성 시 `useHistoryDismiss` hook 사용 의무** (S204 도입). 풀스크린/풀높이 모달은 모바일 back 버튼 = 닫기 가 표준. ConfirmModal 류 (명시 선택 강제) 는 예외. 자세한 패턴: `memory/feedback_modal_history_dismiss_required.md`.
- **신규 정적 이미지 추가 시 `npm run gen:image-blur` 재실행** (S205 도입). LQIP blurDataURL 자동 생성 → cafe-menu-blur.json / products-blur.json 갱신 → next/image placeholder=blur 자동 적용.

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

### 4. 스크린샷 사용 기준
- 레이아웃·전체 비주얼 확인이 필요할 때만 스크린샷을 사용한다.
- 단순 속성 변경(색상, 크기, 폰트 등)은 **inspect 검증만으로 완료**한다.

---

## 핸드오버 메모리 작성 규칙

> 운영 규칙: `memory/feedback_next_session_single_file.md` (단일 파일 덮어쓰기 원칙)

### 단일 파일 덮어쓰기 원칙

매 세션 종료 시 **`memory/NEXT_SESSION.md` 한 파일만 전체 덮어쓰기**. 새 세션은 첫 메시지에 **"진입"** 한 단어 입력 시 이 파일을 읽고 bootstrap.

- 고정 파일: `memory/NEXT_SESSION.md` (이름 변경 금지 · 경로 고정)
- 방식: Write 도구로 전체 덮어쓰기 (Edit 아님)
- fenced code block 프롬프트는 **더 이상 생성하지 않음** (사용자 명시 요청 시에만)

### 병행 유지 (히스토리 추적)

- `project_session{N}_complete.md` — 세션별 완료 스냅샷 (append-only)
- `MEMORY.md [LATEST]` 포인터 — 매 세션 갱신

### 자동 트리거 (명시 요청 없이 실행)

1. **페이즈·도메인 완료 커밋 + 푸시 직후** — `project_session{N}_complete.md` 작성 + `NEXT_SESSION.md` 덮어쓰기
2. **세션 리셋·`/clear` 직전** — `NEXT_SESSION.md` 덮어쓰기
3. **Compaction 3회 이상 + 클린 커밋 경계** — 동일

### 핵심 원칙

- **단일 파일 + 덮어쓰기:** 복사본 누적 금지
- **결과 문서 포인터 원칙:** `NEXT_SESSION.md` 하나만 읽으면 모든 관련 문서 위치를 알 수 있어야 한다
- **커밋 후 작성:** 커밋·푸시 → complete 메모리 → NEXT_SESSION.md 덮어쓰기 순서 준수
- **MEMORY.md 인덱스 동시 등록** 필수

### NEXT_SESSION.md 표준 슬롯 (의무)

매 세션 종료 시 NEXT_SESSION.md 작성에 다음 7 슬롯 포함 (누락 시 다음 sprint 회귀 위험):

1. **선행 액션** (해당 시) — 사용자가 새 세션 진입 전 수행할 액션 (DB 마이그·환경변수 등)
2. **선행 로드** — `project_session{N}_complete.md` + 마일스톤 § 해당 Phase + 관련 spec/소스 파일
3. **범위** — 1~3줄 scope (포함/제외 명시) + 시간 추정 + 추천 모델
4. **세부 작업** — Step 별 분해 + 검증 기준
5. **회귀 검증 체크리스트** — golden path + edge case 항목 list (사전 작성 의무. 구현 후 만들면 누락 위험)
6. **상태 스냅샷** — 브랜치 / 최신 커밋 / push 상태 / 테스트·빌드 상태
7. **검증 명령** — `tsc / test / build / lint` 명령

회귀 체크리스트 (5번) 누락 시 sprint 진입 전 사용자 confirm 받아 보강.

추가 권장:
- 의사결정 잠금 (DEC-N · 변경 금지) — 해당 시
- 다음 sprint 카탈로그 — 해당 시
- 운영 규칙 reminder — 해당 시
