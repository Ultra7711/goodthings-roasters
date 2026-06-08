import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   reviewModeration.ts — 리뷰 욕설 필터 (Phase 2 · S315)

   책임:
   - 리뷰 본문을 로컬 사전(profanityCore)으로 분류 → status 결정
   - moderation_result jsonb 반환 (085 컬럼 · 어드민 /admin/reviews 검토용 보존)

   설계 (S315 · 사용자 확정):
   - vendor 없음 — 외부 AI/API 0. 자체 보유 사전(badwords-ko MIT 기반 큐레이션).
   - 시점 = 동기 (createReview/updateReview 안에서 호출 · ~0.1ms · 결정적).
   - 정책 = 강(명백 욕설)→blocked 자동차단 / 약(경계·혐오)→pending 어드민 검토 /
            clean→approved 즉시 게재.

   확률적 AI 대비 장점(사용자 통찰):
   - 결정적(같은 입력=같은 결과)·검증 가능·0비용·만료 없음·네트워크 0.
   - 명백 욕설은 사전에 있으면 100% 차단(AI 의 확률적 누락 없음).
   - 신조어·문맥 의존은 약(pending) + 어드민 검토가 흡수.

   참조: profanityCore.ts (분류) · profanityWords.ts (raw 사전)
   ════════════════════════════════════════════════════════════════════════ */

import type { ReviewStatus } from '@/types/review';
import { classifyProfanity, type ProfanityTier } from './profanityCore';

/* moderation_result jsonb 에 보존되는 결과 (어드민 검토용). */
type ModerationResult = {
  provider: 'local';
  tier: ProfanityTier;
  /** 매칭된 사전 단어 (어드민 근거). clean 이면 null. */
  matched: string | null;
  checkedAt: string;
};

/** 분류 결과 → 리뷰 status 결정 (deleted 제외). */
export type ModerationDecision = {
  status: Extract<ReviewStatus, 'approved' | 'blocked' | 'pending'>;
  result: ModerationResult;
};

const TIER_TO_STATUS: Record<ProfanityTier, ModerationDecision['status']> = {
  strong: 'blocked',
  watch: 'pending',
  clean: 'approved',
};

/**
 * 리뷰 본문을 로컬 사전으로 검수해 status 결정을 반환한다.
 * 동기 로직이지만 호출부(createReview) 계약 유지를 위해 async 시그니처를 둔다.
 */
export async function moderateReviewBody(body: string): Promise<ModerationDecision> {
  const { tier, matched } = classifyProfanity(body);
  return {
    status: TIER_TO_STATUS[tier],
    result: {
      provider: 'local',
      tier,
      matched,
      checkedAt: new Date().toISOString(),
    },
  };
}
