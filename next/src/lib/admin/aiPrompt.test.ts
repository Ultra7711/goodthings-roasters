/* ══════════════════════════════════════════════════════════════════════════
   aiPrompt.test.ts — Stage 1 + Stage 2 prompt builder 단위 테스트 (S276 · S277 정정)

   Stage 1 = 이미지 AI 에게 배경 이미지 생성 prompt
   Stage 2 = HTML 생성 AI 에게 responsive.html 작성 prompt (spec-heavy)

   시스템 정합 (강제 — S276 박음):
   - 4 BP wrap class 명명
   - 좌측 패딩 60 / 48 / 48 / 32
   - 폰트 시스템 (Pretendard + Inter 만)

   S277 정정 (디자인 결정은 원본 컨셉에서 추출 · 사이트 톤 강제 폐기):
   - Stage 1 안전영역 = 단색/그라데이션 비움 (디테일 0)
   - Stage 2 사이트 톤 강제 폐기 → 디자인 언어 추출 의무
   - Stage 2 invention 금지 (element + 단어 양쪽)
   - Stage 2 모델 중립 (Claude · GPT · Gemini 동등)
   - Stage 2 portrait 동일 적용 강조
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { buildBannerAiPrompt, buildStage2Prompt } from './aiPrompt';

describe('buildBannerAiPrompt (Stage 1)', () => {
  it('signature kind 라벨 정확', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    expect(p).toMatch(/시그니처 chapter/);
  });

  it('cafe-event kind 라벨 정확', () => {
    const p = buildBannerAiPrompt({ kind: 'cafe-event' });
    expect(p).toMatch(/카페 배너/);
  });

  it('aspect 옵션이 prompt 안에 포함', () => {
    const p = buildBannerAiPrompt({
      kind: 'signature',
      aspectDesktop: '1600/600',
      aspectMobile: '390/520',
    });
    expect(p).toMatch(/1600\/600/);
    expect(p).toMatch(/390\/520/);
  });

  it('Stage 2 chain 안내 포함 (S276 chain)', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    expect(p).toMatch(/Stage 2 prompt/);
    expect(p).toMatch(/responsive HTML 자동 변환/);
  });

  it('S277 — 안전영역 비움 강제 (단색/그라데이션 · 디테일 0)', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    expect(p).toMatch(/안전영역 = 비주얼 디테일 0/);
    expect(p).toMatch(/단색 또는 부드러운 그라데이션만/);
    expect(p).toMatch(/가로형.*좌측 40~50%/);
    expect(p).toMatch(/세로형.*상단 40~45%/);
  });

  it('S277 — 안전영역 안 금지 디테일 list (식재료/소품/그림자 등)', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    /* loose match — 나열 순서/예시 단어 변경에 깨지지 않게 */
    expect(p).toMatch(/코코넛|원두|잎|식재료/);
    expect(p).toMatch(/소품|텍스처|컬러 점|그림자/);
    expect(p).toMatch(/어떤 형태의 디테일도 금지/);
  });

  it('S277 — Stage 1 자가 검증 가이드 (흰색 + 검정 가독성)', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    expect(p).toMatch(/자가 검증/);
    expect(p).toMatch(/흰색.*검정.*가상 배치/);
    expect(p).toMatch(/둘 다 OK 여야 통과/);
  });

  it('S277 — 안전영역 비움 이유 (Stage 2 overlay 회귀 차단)', () => {
    const p = buildBannerAiPrompt({ kind: 'signature' });
    expect(p).toMatch(/Stage 2 가 텍스트 가독성 위해 어두운 overlay/);
    expect(p).toMatch(/원천 차단/);
  });
});

describe('buildStage2Prompt (S276)', () => {
  it('kind 라벨 정확 (signature / cafe-event 분기)', () => {
    expect(buildStage2Prompt({ kind: 'signature' })).toMatch(/시그니처 chapter/);
    expect(buildStage2Prompt({ kind: 'cafe-event' })).toMatch(/카페 배너/);
  });

  it('모델 중립 표기 (Claude · GPT · Gemini 동등 · S277 정정)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    /* 본문 "추천 AI" = 범용 멀티모달 + 3 모델 동등 표기 */
    expect(p).toMatch(/범용 멀티모달 AI/);
    expect(p).toMatch(/Claude.*GPT.*Gemini/);
    /* "Claude Opus 4.7" 단독 추천 표현 0 (참고 문구의 단순 언급은 OK) */
    expect(p).not.toMatch(/추천 AI:\s*\*\*Claude Opus 4\.7\*\*/);
    expect(p).not.toMatch(/사이트 톤 가장 정합/);
  });

  it('4 BP wrap class 명명 시스템 제약 박힘', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/\.landscape-max-wrap/);
    expect(p).toMatch(/\.landscape-min-wrap/);
    expect(p).toMatch(/\.portrait-max-wrap/);
    expect(p).toMatch(/\.portrait-min-wrap/);
  });

  it('aspect 입력 → wrap width × height 계산 (1440 / 768 / 767 / 360 base)', () => {
    const p = buildStage2Prompt({
      kind: 'signature',
      aspectDesktop: '1440/504',
      aspectMobile: '390/520',
    });
    /* 1440 × 504 → landscape-max = 1440px × 504px */
    expect(p).toMatch(/landscape-max-wrap: 1440px × 504px/);
    /* 1440 × 504 → landscape-min (768px base) = 768 × (504 / 1440 * 768) = 768 × 269 */
    expect(p).toMatch(/landscape-min-wrap: 768px × 269px/);
    /* 390 × 520 → portrait-max (767px base) = 767 × (520/390 * 767) ≈ 767 × 1023 */
    expect(p).toMatch(/portrait-max-wrap:  767px × 1023px/);
    /* portrait-min = 360 × (520/390 * 360) ≈ 360 × 480 */
    expect(p).toMatch(/portrait-min-wrap:  360px × 480px/);
  });

  it('aspect 미지정 시 fallback (height 미지정)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/height 미지정/);
  });

  it('좌측 패딩 운영 규칙 박힘 (60 / 48 / 48 / 32)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/landscape-max-wrap.*60px/);
    expect(p).toMatch(/landscape-min-wrap.*48px/);
    expect(p).toMatch(/portrait-max-wrap.*48px/);
    expect(p).toMatch(/portrait-min-wrap.*32px/);
  });

  it('폰트 시스템 시스템 제약 (Pretendard + Inter 만)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/pretendardvariable\.min\.css/);
    expect(p).toMatch(/family=Inter/);
    expect(p).toMatch(/--font-en.*Inter/);
    expect(p).toMatch(/--font-kr.*Pretendard/);
    /* 금지 패밀리 명시 */
    expect(p).toMatch(/Noto Sans KR.*추가 패밀리/);
  });

  it('5종 강제 폐기 (S277) — "단순화 의도 5종 만" 표현 0', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    /* 폐기된 강제 표현이 본문에 박혀 있지 않음 */
    expect(p).not.toMatch(/단순화 의도.*\(원본 모든 요소 재현 X\)/);
    expect(p).not.toMatch(/5종\) 만/);
    expect(p).not.toMatch(/헤드라인 \+ 부제 \+ 시리즈 라벨 \+ 메뉴 리스트 \+ 배지/);
  });

  it('사이트 톤 강제 폐기 (S277) — UBE 박힌 색상/레이아웃 강제 0', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    /* 박혔던 사이트 톤 강제 헤더 표현 0 */
    expect(p).not.toMatch(/### 3\. 사이트 디자인 톤/);
    /* UBE 시즌 색상 박힘 0 (예시 `rgba(74,37,128,.2)` 폐기) */
    expect(p).not.toMatch(/rgba\(74\s*,\s*37\s*,\s*128/);
    /* 단순화 강제 폐기 표현은 본문 컨텍스트로 등장 OK — 강제 헤더만 검증 */
  });

  it('디자인 언어 추출 의무 (S277 신규 §3)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/디자인 언어 추출/);
    expect(p).toMatch(/색상 팔레트.*추출|원본 컨셉.*추출/);
    expect(p).toMatch(/사이트 톤 강제 X/);
    expect(p).toMatch(/시즌별 디자인 결정.*≠.*일반 디자인 룰/);
  });

  it('invention 금지 — element (S277 신규 §4)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/invention 금지/);
    expect(p).toMatch(/element invention 금지/);
    expect(p).toMatch(/배지.*border-radius:50%/);
    expect(p).toMatch(/divider/);
    expect(p).toMatch(/overlay/);
    expect(p).toMatch(/카드 그리드/);
  });

  it('invention 금지 — 단어 (S277 신규 §4)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/단어 invention 금지/);
    expect(p).toMatch(/운영자 입력 외.*자동 생성 금지/);
    expect(p).toMatch(/New.*Signature.*Limited|Limited.*Signature/);
    expect(p).toMatch(/시즌 한정.*한정|한정.*시즌/);
  });

  it('안전영역 부족 대응 — 새 영역 발명 금지 (S277)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/안전영역 부족 대응/);
    expect(p).toMatch(/새 영역 발명 금지/);
    expect(p).toMatch(/폰트 크기 축소.*줄바꿈|줄바꿈.*폰트 크기 축소/);
  });

  it('portrait 동일 적용 강조 (S277 신규 §5)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/portrait.*동일 적용|4 BP 모두.*동일 적용/);
    expect(p).toMatch(/portrait.*침범 위험 더 큼|폭이 좁아.*침범/);
    expect(p).toMatch(/상단 또는 하단 줄에 분리 배치/);
  });

  it('운영자 입력 SEO 메타 → prompt 안에 그대로 박힘', () => {
    const p = buildStage2Prompt({
      kind: 'signature',
      headlineText: 'My Custom Title',
      subheadText: '한글 부제 본문',
      ctaText: '자세히 보기',
      imageAlt: 'banner alt text',
    });
    expect(p).toMatch(/"My Custom Title"/);
    expect(p).toMatch(/"한글 부제 본문"/);
    expect(p).toMatch(/"자세히 보기"/);
    expect(p).toMatch(/"banner alt text"/);
  });

  it('운영자 입력 SEO 메타 없으면 안내 fallback', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/운영자 입력 없음/);
    expect(p).toMatch(/AI 가 컨셉 이미지 기반/);
  });

  it('자가 검증 체크리스트 + 다음 단계 안내', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/자가 검증 체크리스트/);
    expect(p).toMatch(/responsive HTML 자동 변환/);
    expect(p).toMatch(/디자이너 검수 옵션/);
  });

  it('폰트 크기 가이드 표 포함 (양 끝점 모델 — production clamp 식의 양 끝점)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/양 끝점 모델/);
    expect(p).toMatch(/landscape-max.*1440/);
    expect(p).toMatch(/portrait-min.*360/);
    expect(p).toMatch(/헤드라인.*영문/);
    expect(p).toMatch(/부제.*한글/);
  });
});
