/* ══════════════════════════════════════════════════════════════════════════
   reviewModeration.test.ts — 로컬 사전 분류 판정 unit test

   커버리지:
   - 강(명백 욕설) → blocked + matched 보존
   - 강 우회(공백·숫자·특수문자 삽입) → 정규화로 blocked
   - 약(혐오·경계) → pending
   - clean → approved
   - 화이트리스트(존맛·미친 강조 등 커피 리뷰 긍정어) → approved (오탐 방지 핵심)
   - 빈/공백 → approved
   ══════════════════════════════════════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { moderateReviewBody } from './reviewModeration';

describe('moderateReviewBody — 로컬 사전 분류', () => {
  it('명백 욕설 → blocked + matched 보존', async () => {
    const d = await moderateReviewBody('씨발 맛없어');
    expect(d.status).toBe('blocked');
    expect(d.result.tier).toBe('strong');
    expect(d.result.matched).toBeTruthy();
    expect(d.result.provider).toBe('local');
  });

  it('욕설 우회(숫자·공백·특수문자) → 정규화로 blocked', async () => {
    for (const text of ['시1발', '시 발', '씨@발', '병1신', 'ㅅ.ㅂ']) {
      const d = await moderateReviewBody(text);
      expect(d.status, `"${text}" 는 차단돼야 함`).toBe('blocked');
    }
  });

  it('혐오·위협 → blocked (작성 거부)', async () => {
    for (const text of ['짱깨 같은', '조센징', '김치녀', '뒈져라', '정신병자', '쪽바리']) {
      const d = await moderateReviewBody(text);
      expect(d.status, `"${text}" 는 차단돼야 함`).toBe('blocked');
    }
  });

  it('경계·문맥의존어 → pending (어드민 검토)', async () => {
    for (const text of ['존나 맛있다', '졸라 좋음', '기레기네', '미친새 진짜', '찌질하다']) {
      const d = await moderateReviewBody(text);
      expect(d.status, `"${text}" 는 대기여야 함`).toBe('pending');
      expect(d.result.tier).toBe('watch');
    }
  });

  it('정상 리뷰 → approved', async () => {
    for (const text of ['정말 향이 좋아요', '고소하고 균형 잡힌 맛', '배송 빨라요']) {
      const d = await moderateReviewBody(text);
      expect(d.status, `"${text}" 는 게재돼야 함`).toBe('approved');
      expect(d.result.tier).toBe('clean');
      expect(d.result.matched).toBeNull();
    }
  });

  it('화이트리스트(긍정 강조어) → approved (오탐 방지)', async () => {
    for (const text of ['존맛탱 최고예요', '졸맛입니다', '미친 고소함', '존좋', '개존맛']) {
      const d = await moderateReviewBody(text);
      expect(d.status, `"${text}" 는 게재돼야 함(오탐 금지)`).toBe('approved');
    }
  });

  it('욕설+긍정 혼합 → 욕설 우선 blocked', async () => {
    const d = await moderateReviewBody('씨발 존맛이긴 함');
    expect(d.status).toBe('blocked');
  });

  it('빈/공백 본문 → approved', async () => {
    const d = await moderateReviewBody('   ');
    expect(d.status).toBe('approved');
  });
});
