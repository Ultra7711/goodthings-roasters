---
title: Claude Design 핸드오프 패키지 — Phase 3 팔레트 실험
created: 2026-04-18
session: 22
branch: claude/design-polish
status: RETIRED (Session 33 에서 01~09 패키지로 대체)
superseded_by: README.md · 01-screenshots-session33/ · 02~09 파일
---

> ⚠️ **은퇴 (2026-04-19)** — 이 문서는 Session 22 1차 실험용. Claude Design 2차 실험은 본 디렉터리의
> `README.md` + `07-prompt.md` + 첨부 8종 을 사용하세요. 아래 내용은 히스토리 보존용.



# Claude Design 핸드오프 패키지

Anthropic Labs 의 **Claude Design** (claude.ai → Labs → Design) 에 업로드하여
**구조 불변 · 시각(팔레트/레이아웃) 변주** 실험용.

## 사용 순서

1. 아래 **스크린샷 캡처** 섹션의 페이지들을 브라우저 1440px 뷰포트에서 저장
2. 아래 **프롬프트 템플릿** 을 복사
3. claude.ai → Labs → Claude Design 접속 (Pro/Max/Team 플랜)
4. 새 프로젝트 생성 → 프롬프트 + 스크린샷 + 토큰 블록 업로드
5. 생성된 변주 중 채택안 → "Export as HTML" 또는 "Hand off to Claude Code" → 본 세션으로 전달
6. 채택안 색상만 추출 → `globals.css` 의 토큰 스왑 1커밋

## 스크린샷 캡처 (1440px)

| # | 페이지 | URL | 중점 |
|---|--------|-----|------|
| 1 | Home 히어로 | `/` | 배경·헤더·CTA 톤 |
| 2 | Home 스토리·Featured Beans | `/` (하단) | 섹션 전환·eyebrow |
| 3 | The Story | `/story` | 지그재그·본문 색 |
| 4 | Shop 리스트 | `/shop` | 썸네일·카드 배경 |
| 5 | 상품 상세 | `/shop/autumn-night` | 구매박스·게이지·뱃지 |
| 6 | /cart (신규) | `/cart` | 테이블·푸터·뱃지 |
| 7 | MyPage | `/mypage` | 카테고리·내역 톤 |

저장 경로: `docs/design-baseline/session22-*.png`

## 프롬프트 템플릿 (복사해서 Claude Design 에 붙여넣기)

```
프로젝트: Good Things Roasters — 스페셜티 커피 커머스
스타일: Warm-shifted B&W (편집 잡지 느낌), 한글·영문 혼용 타이포

요청: 아래 현재 사이트 스크린샷과 CSS 토큰 시스템을 기반으로,
**구조·레이아웃·컴포넌트 DOM 은 그대로 유지**하면서 시각 변주 3안을 생성.

변주 방향 (Session 18 #32 에디토리얼 팔레트 재해석):
1. A안 — warm paper 3단 로테이션
   - 섹션 배경이 --color-background-primary(#FAFAF8) → secondary(#F5F3F0) → tertiary(#ECEAE6) 로
     리듬감 있게 전환
   - 골드 eyebrow(--color-accent-gold #A47146) 를 divider·prefix rule 로 확장 사용

2. B안 — 번트오렌지 2차 악센트
   - 기존 warm B&W 유지 + 번트오렌지(#C56B3A~#B55A2A) 를 CTA hover·active 상태 강조에만 한정 투입
   - 골드는 caption·eyebrow 용으로 역할 분리

3. C안 — surface stone 활용
   - --color-surface-stone(#4A4845) 를 Featured Beans·Story 섹션 일부 카드 배경으로 투입
   - 해당 카드 내부 텍스트만 dark-mode 색 적용 (전체 다크모드 아님)

공통 제약:
- 타이포그래피 스케일·폰트 패밀리·스페이싱 토큰 변경 금지
- 컴포넌트 구조 변경 금지 (DOM 동일)
- 컬러 토큰만 변경 허용 (globals.css :root 섹션)
- warm 톤 유지 (쿨 그레이 금지)

출력 형식:
- 각 안별 Home·Story·Shop·ProductDetail 4페이지 미리보기
- 변경된 토큰 값만 리스트 (diff 형태)
- 최종: ZIP 또는 독립형 HTML
```

## 업로드용 토큰 블록

아래 블록을 복사해서 Claude Design 에 "현재 토큰 시스템" 으로 첨부.

```css
/* Good Things Roasters — Core Design Tokens (globals.css 발췌) */

/* Background */
--color-background-primary: #FAFAF8;      /* warm white */
--color-background-secondary: #F5F3F0;
--color-background-tertiary: #ECEAE6;
--color-background-inverse: #1C1B19;       /* warm black */

/* Text (Light) */
--color-text-primary:   #1C1B19;           /* 헤딩·CTA */
--color-text-secondary: #4A4843;           /* 본문 */
--color-text-tertiary:  #6B6863;           /* 보조·메타 */
--color-text-caption:   #9C9890;
--color-text-hint:      #A8A49E;

/* Text (Dark-bg) */
--color-text-inverse:   #FAFAF8;
--color-text-heading-dark:  #EFEEED;
--color-text-body-dark:     #D6D5D3;
--color-text-support-dark:  #C2C2C0;
--color-text-caption-dark:  #969593;

/* Surface */
--color-surface-stone: #4A4845;
--color-surface-warm:  #E8E2DA;

/* CTA */
--color-btn-primary-bg:         #1C1B19;
--color-btn-primary-bg-hover:   #2E2D2A;
--color-btn-primary-bg-active:  #0F0E0D;

/* Accent & Feedback */
--color-accent-gold:    #A47146;   /* eyebrow·divider */
--color-label-on-white: #A08B6D;
--color-label-on-warm:  #857052;
--color-error:   #C4554E;
--color-success: #5C7A4B;
--color-info:    #4A6B8A;
--color-warning: #B8943F;

/* Borders */
--color-border-hairline:  rgba(28,27,25,.06);
--color-border-secondary: rgba(28,27,25,.12);
--color-border-primary:   rgba(28,27,25,.20);
--color-border-surface:   #E8E6E1;  /* 썸네일↔배경 솔리드 외곽선 */

/* 타이포그래피 (변경 금지 — 참고용) */
--type-h1-size: 36px;  weight 300;   letter-spacing -.02em
--type-h2-size: 32px;  weight 300
--type-body-l-size: 18px;  weight 500
--type-body-m-size: 15px;  weight 400
--type-body-s-size: 13px;  weight 400
--font-en: Inter
--font-kr: Pretendard
```

## 핸드오프 수신 시 이 세션이 할 일

1. Claude Design 에서 다운받은 변주 HTML 확인
2. 변경된 토큰 값만 추출 (3~8개 예상)
3. `globals.css` `@theme` / `:root` 의 해당 변수만 교체
4. `npx next build` 통과 확인
5. 단일 커밋 `style(palette): Phase 3 팔레트 A/B/C안 적용 (#32)` 로 저장
6. 실패 시 `git reset --hard e4ebd21d` 로 1커밋 롤백

## 제약 재확인

- Claude Design 에 **전체 globals.css (6024줄) 업로드 금지** — 성능 저하
- 위 토큰 블록 + 페이지 스크린샷만으로 충분
- 프로토타입 parity 가 필요한 Phase 2 항목 (#15·#28) 은 이 실험에서 제외
