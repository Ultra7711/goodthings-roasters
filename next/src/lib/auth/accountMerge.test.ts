/* ══════════════════════════════════════════
   accountMerge 정책 유닛 테스트
   ADR-001 §3.2 결정 매트릭스 전수 검증.

   커버리지:
   - resolveAccountMerge: allow_new / allow_same / allow_merge / block 전 분기
   - buildMergeMetadata: providers 배열 병합·dedup·promoteVerified
   - readPrimaryProvider: providers 배열 / provider 문자열 / Google iss 탐지 fallback
   - findUserByEmail: case-insensitive / 페이지네이션 / miss

   Mock 전략:
   - SupabaseClient.auth.admin.listUsers 만 모킹 (findUserByEmail 유일 외부 의존)
   ══════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  resolveAccountMerge,
  buildMergeMetadata,
  type MergeContext,
  type MergeDecision,
} from './accountMerge';

/* ── Mock helpers ── */

type MockUser = Pick<User, 'id' | 'email' | 'user_metadata' | 'email_confirmed_at'>;

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: overrides.id ?? `user-${Math.random().toString(36).slice(2, 10)}`,
    email: overrides.email ?? 'user@example.com',
    user_metadata: overrides.user_metadata ?? {},
    email_confirmed_at: overrides.email_confirmed_at ?? null,
  };
}

/**
 * listUsers 만 구현한 최소 SupabaseClient mock.
 * resolveAccountMerge/findUserByEmail 는 listUsers 만 호출하므로 충분.
 */
function createMockSupabase(users: MockUser[]): SupabaseClient {
  return {
    auth: {
      admin: {
        listUsers: async ({
          page = 1,
          perPage = 200,
        }: { page?: number; perPage?: number } = {}) => {
          const start = (page - 1) * perPage;
          const pageUsers = users.slice(start, start + perPage);
          return { data: { users: pageUsers }, error: null };
        },
      },
    },
  } as unknown as SupabaseClient;
}

function baseContext(overrides: Partial<MergeContext> = {}): MergeContext {
  return {
    email: 'new@example.com',
    emailVerified: true,
    provider: 'google',
    isSynthetic: false,
    ...overrides,
  };
}

/* ══════════════════════════════════════════
   resolveAccountMerge — 결정 매트릭스
   ══════════════════════════════════════════ */

describe('resolveAccountMerge', () => {
  describe('allow_new', () => {
    it('기존 계정 없음 → allow_new', async () => {
      const supabase = createMockSupabase([]);
      const decision = await resolveAccountMerge(
        baseContext({ email: 'first@example.com' }),
        supabase,
      );
      expect(decision).toEqual({ action: 'allow_new' });
    });

    it('isSynthetic=true 는 기존 계정이 있어도 allow_new (findUserByEmail 단락)', async () => {
      const supabase = createMockSupabase([
        makeUser({
          email: 'kakao_123@kakao-oauth.internal',
          user_metadata: { provider: 'kakao' },
        }),
      ]);
      const decision = await resolveAccountMerge(
        baseContext({
          email: 'kakao_123@kakao-oauth.internal',
          provider: 'kakao',
          isSynthetic: true,
          emailVerified: false,
        }),
        supabase,
      );
      expect(decision).toEqual({ action: 'allow_new' });
    });
  });

  describe('allow_same', () => {
    it('동일 provider 재로그인 → allow_same', async () => {
      const existing = makeUser({
        id: 'u-1',
        email: 'same@example.com',
        user_metadata: { provider: 'google', providers: ['google'] },
        email_confirmed_at: '2026-01-01T00:00:00Z',
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({ email: 'same@example.com', provider: 'google' }),
        supabase,
      );
      expect(decision).toEqual({ action: 'allow_same', userId: 'u-1' });
    });
  });

  describe('allow_merge', () => {
    it('양쪽 검증 + 다른 provider → allow_merge (promoteVerified: false)', async () => {
      const existing = makeUser({
        id: 'u-2',
        email: 'both-verified@example.com',
        user_metadata: { provider: 'email', email_verified: true },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'both-verified@example.com',
          provider: 'google',
          emailVerified: true,
        }),
        supabase,
      );
      expect(decision).toEqual({
        action: 'allow_merge',
        userId: 'u-2',
        addProvider: 'google',
        promoteVerified: false,
      });
    });

    it('기존 미검증 + 신규 검증 → allow_merge (promoteVerified: true)', async () => {
      const existing = makeUser({
        id: 'u-3',
        email: 'promote@example.com',
        user_metadata: { provider: 'naver', email_verified: false },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'promote@example.com',
          provider: 'google',
          emailVerified: true,
        }),
        supabase,
      );
      expect(decision).toEqual({
        action: 'allow_merge',
        userId: 'u-3',
        addProvider: 'google',
        promoteVerified: true,
      });
    });
  });

  describe('block — 시나리오 A 탈취 방어', () => {
    it('기존 검증 + 신규 미검증 → block (account_conflict_{existing})', async () => {
      const existing = makeUser({
        id: 'u-4',
        email: 'target@example.com',
        user_metadata: { provider: 'google', email_verified: true },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'target@example.com',
          provider: 'naver', // Naver 는 항상 미검증
          emailVerified: false,
        }),
        supabase,
      );
      expect(decision).toEqual({
        action: 'block',
        code: 'account_conflict_google',
        existingProvider: 'google',
      });
    });

    it('email 계정(검증) 대상 Naver 미검증 로그인 시도 → block', async () => {
      const existing = makeUser({
        id: 'u-5',
        email: 'hijack@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        user_metadata: { provider: 'email' },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'hijack@example.com',
          provider: 'naver',
          emailVerified: false,
        }),
        supabase,
      );
      expect(decision).toMatchObject({
        action: 'block',
        code: 'account_conflict_email',
      });
    });

    it('양쪽 미검증 + provider 다름 → block (보수적)', async () => {
      const existing = makeUser({
        id: 'u-6',
        email: 'both-unverified@example.com',
        user_metadata: { provider: 'naver', email_verified: false },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'both-unverified@example.com',
          provider: 'kakao',
          emailVerified: false,
        }),
        supabase,
      );
      expect(decision).toEqual({
        action: 'block',
        code: 'account_conflict_naver',
        existingProvider: 'naver',
      });
    });
  });

  describe('readPrimaryProvider — 간접 검증 (이슈 1 Google iss 탐지)', () => {
    it('Google raw profile(iss) 는 user_metadata.provider 없어도 google 로 탐지', async () => {
      const existing = makeUser({
        id: 'u-google-raw',
        email: 'raw-google@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        user_metadata: {
          // P1-1 이전 Supabase 네이티브 OAuth 로 생성된 유저 — provider/providers 없음
          iss: 'https://accounts.google.com',
          sub: '1234567890',
          email_verified: true,
        },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'raw-google@example.com',
          provider: 'google',
          emailVerified: true,
        }),
        supabase,
      );
      // iss 탐지가 정상 작동하면 existingProvider === 'google' → allow_same
      expect(decision).toEqual({ action: 'allow_same', userId: 'u-google-raw' });
    });

    it('providers 배열 우선 (provider 문자열보다 우선)', async () => {
      const existing = makeUser({
        id: 'u-array',
        email: 'array@example.com',
        email_confirmed_at: '2026-01-01T00:00:00Z',
        user_metadata: {
          providers: ['kakao', 'google'], // 첫 요소 kakao 가 primary
          provider: 'google', // fallback (우선순위 낮음)
        },
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'array@example.com',
          provider: 'kakao',
          emailVerified: true,
        }),
        supabase,
      );
      expect(decision).toMatchObject({ action: 'allow_same' });
    });
  });

  describe('findUserByEmail — 간접 검증', () => {
    it('case-insensitive 이메일 매칭', async () => {
      const existing = makeUser({
        id: 'u-case',
        email: 'MixedCase@Example.COM',
        user_metadata: { provider: 'google' },
        email_confirmed_at: '2026-01-01T00:00:00Z',
      });
      const supabase = createMockSupabase([existing]);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'mixedcase@example.com',
          provider: 'google',
          emailVerified: true,
        }),
        supabase,
      );
      expect(decision).toMatchObject({ action: 'allow_same', userId: 'u-case' });
    });

    it('2페이지 이상 페이지네이션 (perPage=200 기준)', async () => {
      // 350명 유저 목록 — 2페이지에 타겟 배치
      const users: MockUser[] = [];
      for (let i = 0; i < 350; i += 1) {
        users.push(
          makeUser({ id: `u-${i}`, email: `user-${i}@example.com` }),
        );
      }
      users[250] = makeUser({
        id: 'u-target',
        email: 'target-page2@example.com',
        user_metadata: { provider: 'google' },
        email_confirmed_at: '2026-01-01T00:00:00Z',
      });
      const supabase = createMockSupabase(users);

      const decision = await resolveAccountMerge(
        baseContext({
          email: 'target-page2@example.com',
          provider: 'google',
          emailVerified: true,
        }),
        supabase,
      );
      expect(decision).toMatchObject({ action: 'allow_same', userId: 'u-target' });
    });

    it('매칭 없음 → allow_new', async () => {
      const supabase = createMockSupabase([
        makeUser({ email: 'other1@example.com' }),
        makeUser({ email: 'other2@example.com' }),
      ]);
      const decision = await resolveAccountMerge(
        baseContext({ email: 'nobody@example.com' }),
        supabase,
      );
      expect(decision).toEqual({ action: 'allow_new' });
    });

    it('빈 이메일 → allow_new (방어적)', async () => {
      const supabase = createMockSupabase([]);
      const decision = await resolveAccountMerge(
        baseContext({ email: '   ' }),
        supabase,
      );
      expect(decision).toEqual({ action: 'allow_new' });
    });
  });
});

/* ══════════════════════════════════════════
   buildMergeMetadata
   ══════════════════════════════════════════ */

describe('buildMergeMetadata', () => {
  const mergeDecision = (overrides: Partial<Extract<MergeDecision, { action: 'allow_merge' }>> = {}) =>
    ({
      action: 'allow_merge',
      userId: 'u-x',
      addProvider: 'google',
      promoteVerified: false,
      ...overrides,
    }) as Extract<MergeDecision, { action: 'allow_merge' }>;

  it('기존 providers 없으면 신규만 담은 배열로 초기화', () => {
    const merged = buildMergeMetadata({ full_name: '장재웅' }, mergeDecision());
    expect(merged.providers).toEqual(['google']);
    expect(merged.full_name).toBe('장재웅');
  });

  it('기존 providers 배열에 신규 provider 추가', () => {
    const merged = buildMergeMetadata(
      { providers: ['email'] },
      mergeDecision({ addProvider: 'google' }),
    );
    expect(merged.providers).toEqual(['email', 'google']);
  });

  it('이미 존재하는 provider 는 dedup', () => {
    const merged = buildMergeMetadata(
      { providers: ['email', 'google'] },
      mergeDecision({ addProvider: 'google' }),
    );
    expect(merged.providers).toEqual(['email', 'google']);
  });

  it('promoteVerified=true → email_verified: true 설정', () => {
    const merged = buildMergeMetadata(
      { email_verified: false, providers: ['naver'] },
      mergeDecision({ addProvider: 'google', promoteVerified: true }),
    );
    expect(merged.email_verified).toBe(true);
    expect(merged.providers).toEqual(['naver', 'google']);
  });

  it('promoteVerified=false → 기존 email_verified 유지', () => {
    const merged = buildMergeMetadata(
      { email_verified: false, providers: ['naver'] },
      mergeDecision({ addProvider: 'google', promoteVerified: false }),
    );
    expect(merged.email_verified).toBe(false);
  });

  it('currentMetadata=undefined → 빈 오브젝트로 처리', () => {
    const merged = buildMergeMetadata(undefined, mergeDecision());
    expect(merged.providers).toEqual(['google']);
  });

  it('currentMetadata=null → 빈 오브젝트로 처리', () => {
    const merged = buildMergeMetadata(null, mergeDecision());
    expect(merged.providers).toEqual(['google']);
  });
});
