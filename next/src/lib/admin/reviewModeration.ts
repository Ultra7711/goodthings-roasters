import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   reviewModeration.ts — 리뷰 AI 욕설 필터 (Phase 2 · S315)

   책임:
   - OpenAI Moderation API(omni-moderation-latest · 무료) 호출 → 리뷰 본문 판정
   - 정책 적용 → 게재(approved) / 차단(blocked) / graceful 큐(pending) 결정
   - moderation_result jsonb 반환 (085 컬럼 · 어드민 /admin/reviews 검토용 보존)

   설계 결정 (S315 Step 0 · 사용자 확정):
   - vendor = OpenAI Moderation 단독 (한국어 정확도 보통 · 어드민 사후 검토가 안전망)
   - 시점   = 동기 (createReview 안에서 호출 — 욕설 게재 0)
   - 정책   = clean→approved / flagged→blocked / 실패·키없음→graceful pending

   graceful 원칙:
   - 절대 throw 금지. API 실패(타임아웃·rate limit·장애)·키 부재 시 'pending' 반환 →
     정상 리뷰 유실 0. 어드민이 /admin/reviews 검토 큐에서 사후 처리.

   참조:
   - 085_user_reviews.sql (moderation_result jsonb · status enum)
   - 088_review_insert_blocked.sql (blocked insert 허용)
   ════════════════════════════════════════════════════════════════════════ */

import type { ReviewStatus } from '@/types/review';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';
/* API 무응답 시 작성 응답이 무한정 대기하지 않도록 상한. graceful → pending. */
const MODERATION_TIMEOUT_MS = 5000;

/* moderation_result jsonb 에 보존되는 결과 (어드민 검토용). ModerationDecision 내부 전용. */
type ModerationResult = {
  provider: 'openai';
  model: string;
  checkedAt: string;
  /** 정상 판정 완료 시 — true=유해 감지 */
  flagged?: boolean;
  /** flagged 카테고리명 목록 (어드민 가독성) */
  categories?: string[];
  /** 전체 카테고리 점수 (감사용) */
  scores?: Record<string, number>;
  /** graceful — 키 부재로 검수 건너뜀 */
  skipped?: 'no_api_key';
  /** graceful — 호출 실패 사유 */
  error?: string;
};

/** 검수 결과 → 리뷰 status 결정 (deleted 제외). */
export type ModerationDecision = {
  status: Extract<ReviewStatus, 'approved' | 'blocked' | 'pending'>;
  result: ModerationResult;
};

/* OpenAI 응답에서 안전하게 첫 result 추출 (외부 데이터 — 신뢰 금지). */
function parseModerationResponse(
  json: unknown,
): { flagged: boolean; categories: string[]; scores: Record<string, number> } | null {
  if (typeof json !== 'object' || json === null) return null;
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  if (typeof first !== 'object' || first === null) return null;

  const flagged = (first as { flagged?: unknown }).flagged === true;

  const rawCategories = (first as { categories?: unknown }).categories;
  const categories: string[] =
    typeof rawCategories === 'object' && rawCategories !== null
      ? Object.entries(rawCategories as Record<string, unknown>)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
      : [];

  const rawScores = (first as { category_scores?: unknown }).category_scores;
  const scores: Record<string, number> =
    typeof rawScores === 'object' && rawScores !== null
      ? Object.fromEntries(
          Object.entries(rawScores as Record<string, unknown>).filter(
            ([, v]) => typeof v === 'number',
          ) as [string, number][],
        )
      : {};

  return { flagged, categories, scores };
}

/**
 * 리뷰 본문을 OpenAI Moderation 으로 검수해 status 결정을 반환한다.
 * 절대 throw 하지 않는다 — 모든 실패 경로는 graceful 'pending'.
 */
export async function moderateReviewBody(body: string): Promise<ModerationDecision> {
  const checkedAt = new Date().toISOString();
  const base: Pick<ModerationResult, 'provider' | 'model' | 'checkedAt'> = {
    provider: 'openai',
    model: MODERATION_MODEL,
    checkedAt,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    /* 키 미설정 — 검수 불가 → graceful 큐(어드민 검토). 정상 리뷰 유실 방지. */
    return { status: 'pending', result: { ...base, skipped: 'no_api_key' } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: body }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { status: 'pending', result: { ...base, error: `http_${res.status}` } };
    }

    const parsed = parseModerationResponse(await res.json());
    if (!parsed) {
      return { status: 'pending', result: { ...base, error: 'parse_failed' } };
    }

    if (parsed.flagged) {
      return {
        status: 'blocked',
        result: { ...base, flagged: true, categories: parsed.categories, scores: parsed.scores },
      };
    }
    return {
      status: 'approved',
      result: { ...base, flagged: false, scores: parsed.scores },
    };
  } catch (err) {
    /* 타임아웃(abort)·네트워크 오류 등 — graceful 큐. */
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timeout' : 'network_error';
    return { status: 'pending', result: { ...base, error: reason } };
  } finally {
    clearTimeout(timer);
  }
}
