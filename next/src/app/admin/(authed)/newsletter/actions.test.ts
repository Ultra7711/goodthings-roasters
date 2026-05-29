/* ══════════════════════════════════════════
   actions.test.ts — /admin/newsletter Server Actions 가드 (S250-2)
   - export: unauthorized / validation_failed
   - sendTest: unauthorized / validation_failed (draft·email)
   - sendCampaign: unauthorized(owner) / validation_failed
   (발송 ok 경로는 sendEmail·getSupabaseAdmin 다수 의존 → 가드만 테스트)
   ══════════════════════════════════════════ */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/getClaims', () => ({
  getAdminClaims: vi.fn(),
  getAdminOwnerClaims: vi.fn(),
}));

import {
  exportNewsletterSubscribersXlsxAction,
  sendTestNewsletterAction,
  sendNewsletterCampaignAction,
} from './actions';
import { getAdminClaims, getAdminOwnerClaims } from '@/lib/auth/getClaims';
import type { NewsletterDraft } from '@/lib/admin/newsletterCompose';

const adminClaimsMock = vi.mocked(getAdminClaims);
const ownerClaimsMock = vi.mocked(getAdminOwnerClaims);

const OWNER_CLAIMS = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'owner@example.com',
  metadata: {},
  role: 'admin' as const,
  adminLevel: 'owner' as const,
  displayName: null,
  title: null,
};

const VALID_DRAFT: NewsletterDraft = {
  subject: '5월 시즌 원두 안내',
  blocks: [
    { type: 'heading', text: '신규 원두 출시' },
    { type: 'paragraph', text: '이번 달 새로운 원두를 소개합니다.' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  adminClaimsMock.mockResolvedValue(OWNER_CLAIMS);
  ownerClaimsMock.mockResolvedValue(OWNER_CLAIMS);
});

describe('exportNewsletterSubscribersXlsxAction', () => {
  it('unauthorized — getAdminOwnerClaims null', async () => {
    ownerClaimsMock.mockResolvedValueOnce(null);
    const res = await exportNewsletterSubscribersXlsxAction({ status: 'all', q: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — invalid status', async () => {
    const res = await exportNewsletterSubscribersXlsxAction({
      status: 'bogus' as unknown as 'all',
      q: '',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });
});

describe('sendTestNewsletterAction', () => {
  it('unauthorized — getAdminClaims null', async () => {
    adminClaimsMock.mockResolvedValueOnce(null);
    const res = await sendTestNewsletterAction(VALID_DRAFT, 'a@b.com');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — invalid email', async () => {
    const res = await sendTestNewsletterAction(VALID_DRAFT, 'not-an-email');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });

  it('validation_failed — empty draft', async () => {
    const res = await sendTestNewsletterAction(
      { subject: '', blocks: [] } as unknown as NewsletterDraft,
      'a@b.com',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });
});

describe('sendNewsletterCampaignAction', () => {
  it('unauthorized — not owner', async () => {
    ownerClaimsMock.mockResolvedValueOnce(null);
    const res = await sendNewsletterCampaignAction(VALID_DRAFT);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('unauthorized');
  });

  it('validation_failed — empty draft', async () => {
    const res = await sendNewsletterCampaignAction(
      { subject: '', blocks: [] } as unknown as NewsletterDraft,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('validation_failed');
  });
});
