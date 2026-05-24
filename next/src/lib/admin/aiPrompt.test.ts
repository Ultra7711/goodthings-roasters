/* ══════════════════════════════════════════════════════════════════════════
   aiPrompt.test.ts — Stage 1 + Stage 2 prompt builder 단위 테스트 (S276)

   Stage 1 = 이미지 AI 에게 배경 이미지 생성 prompt
   Stage 2 = HTML 생성 AI 에게 responsive.html 작성 prompt (spec-heavy)

   S276 의 운영 규칙 박음 확인:
   - 4 BP wrap class 명명
   - 좌측 패딩 60 / 48 / 48 / 32
   - 폰트 시스템 (Pretendard + Inter 만)
   - 사이트 톤 + 단순화 의도
   - Claude Opus 4.7 권장 명시
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
});

describe('buildStage2Prompt (S276)', () => {
  it('kind 라벨 정확 (signature / cafe-event 분기)', () => {
    expect(buildStage2Prompt({ kind: 'signature' })).toMatch(/시그니처 chapter/);
    expect(buildStage2Prompt({ kind: 'cafe-event' })).toMatch(/카페 배너/);
  });

  it('Claude Opus 4.7 default 권장 명시 (S274 fair test 결과)', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/Claude Opus 4\.7/);
    expect(p).toMatch(/사이트 톤 가장 정합/);
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

  it('단순화 의도 (5종 요소만) + feature 바 금지', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/단순화 의도/);
    expect(p).toMatch(/feature 바.*금지|금지.*feature 바/);
    expect(p).toMatch(/5종/);
  });

  it('사이트 톤 (sand bg + 보라/브라운) + 카드형 금지', () => {
    const p = buildStage2Prompt({ kind: 'signature' });
    expect(p).toMatch(/sand bg/);
    expect(p).toMatch(/보라\/브라운/);
    expect(p).toMatch(/카드형.*X|카드 형 X/);
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
