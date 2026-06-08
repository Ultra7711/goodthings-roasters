/* ══════════════════════════════════════════════════════════════════════════
   reviewModeration.test.ts — moderateReviewBody 판정 + graceful unit test

   커버리지:
   - 키 부재 → pending (skipped)
   - clean(flagged:false) → approved
   - flagged:true → blocked + categories 추출
   - http non-ok → pending (http_NNN)
   - 파싱 실패(results 없음) → pending (parse_failed)
   - fetch reject(network) → pending (network_error)
   - abort(timeout) → pending (timeout)
   - 절대 throw 안 함
   ══════════════════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderateReviewBody } from './reviewModeration';

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

function mockFetchOk(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }) as unknown as Response),
  );
}

describe('moderateReviewBody', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it('키 부재 → pending (skipped: no_api_key)', async () => {
    delete process.env.OPENAI_API_KEY;
    const d = await moderateReviewBody('맛있어요');
    expect(d.status).toBe('pending');
    expect(d.result.skipped).toBe('no_api_key');
  });

  it('clean(flagged:false) → approved', async () => {
    mockFetchOk({ results: [{ flagged: false, categories: {}, category_scores: { hate: 0.001 } }] });
    const d = await moderateReviewBody('정말 향이 좋네요');
    expect(d.status).toBe('approved');
    expect(d.result.flagged).toBe(false);
    expect(d.result.scores).toMatchObject({ hate: 0.001 });
  });

  it('flagged:true → blocked + 위반 카테고리만 추출', async () => {
    mockFetchOk({
      results: [
        {
          flagged: true,
          categories: { harassment: true, hate: false, violence: true },
          category_scores: { harassment: 0.95, hate: 0.02, violence: 0.8 },
        },
      ],
    });
    const d = await moderateReviewBody('욕설 본문');
    expect(d.status).toBe('blocked');
    expect(d.result.flagged).toBe(true);
    expect(d.result.categories).toEqual(['harassment', 'violence']);
    expect(d.result.scores?.harassment).toBe(0.95);
  });

  it('http non-ok → pending (http_NNN)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as unknown as Response),
    );
    const d = await moderateReviewBody('본문');
    expect(d.status).toBe('pending');
    expect(d.result.error).toBe('http_429');
  });

  it('파싱 실패(results 없음) → pending (parse_failed)', async () => {
    mockFetchOk({ unexpected: true });
    const d = await moderateReviewBody('본문');
    expect(d.status).toBe('pending');
    expect(d.result.error).toBe('parse_failed');
  });

  it('fetch reject(network) → pending (network_error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );
    const d = await moderateReviewBody('본문');
    expect(d.status).toBe('pending');
    expect(d.result.error).toBe('network_error');
  });

  it('abort(timeout) → pending (timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }),
    );
    const d = await moderateReviewBody('본문');
    expect(d.status).toBe('pending');
    expect(d.result.error).toBe('timeout');
  });
});
