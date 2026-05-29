/* ══════════════════════════════════════════
   newsletterCompose.test.ts — 블록 검증 스키마 (S250-2 Phase 2)
   ══════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import {
  createEmptyBlock,
  isNewsletterImageUrl,
  newsletterDraftSchema,
} from './newsletterCompose';

const VALID_IMAGE_URL =
  'https://proj.supabase.co/storage/v1/object/public/newsletter-images/nl-1-abc.webp';

describe('isNewsletterImageUrl', () => {
  it('우리 newsletter-images public URL 허용', () => {
    expect(isNewsletterImageUrl(VALID_IMAGE_URL)).toBe(true);
  });

  it('외부 URL 거부', () => {
    expect(isNewsletterImageUrl('https://evil.example.com/tracker.png')).toBe(false);
  });

  it('다른 버킷 거부', () => {
    expect(
      isNewsletterImageUrl(
        'https://proj.supabase.co/storage/v1/object/public/product-images/x.webp',
      ),
    ).toBe(false);
  });

  it('http(비https) 거부', () => {
    expect(
      isNewsletterImageUrl(
        'http://proj.supabase.co/storage/v1/object/public/newsletter-images/x.webp',
      ),
    ).toBe(false);
  });
});

describe('newsletterDraftSchema', () => {
  it('유효한 draft 통과', () => {
    const res = newsletterDraftSchema.safeParse({
      subject: '제목',
      blocks: [
        { type: 'heading', text: '헤딩' },
        { type: 'paragraph', text: '본문' },
        { type: 'image', src: VALID_IMAGE_URL, alt: '설명' },
        { type: 'cta', label: '둘러보기', url: 'https://goodthingsroasters.com' },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('빈 제목 거부', () => {
    const res = newsletterDraftSchema.safeParse({
      subject: '',
      blocks: [{ type: 'paragraph', text: '본문' }],
    });
    expect(res.success).toBe(false);
  });

  it('블록 0개 거부', () => {
    const res = newsletterDraftSchema.safeParse({ subject: '제목', blocks: [] });
    expect(res.success).toBe(false);
  });

  it('블록 20개 초과 거부', () => {
    const blocks = Array.from({ length: 21 }, () => ({ type: 'paragraph', text: 'x' }));
    const res = newsletterDraftSchema.safeParse({ subject: '제목', blocks });
    expect(res.success).toBe(false);
  });

  it('외부 이미지 src 거부', () => {
    const res = newsletterDraftSchema.safeParse({
      subject: '제목',
      blocks: [{ type: 'image', src: 'https://evil.com/x.png', alt: '' }],
    });
    expect(res.success).toBe(false);
  });

  it('CTA non-https url 거부', () => {
    const res = newsletterDraftSchema.safeParse({
      subject: '제목',
      blocks: [{ type: 'cta', label: '버튼', url: 'http://example.com' }],
    });
    expect(res.success).toBe(false);
  });
});

describe('createEmptyBlock', () => {
  it('타입별 빈 블록 생성', () => {
    expect(createEmptyBlock('heading')).toEqual({ type: 'heading', text: '' });
    expect(createEmptyBlock('paragraph')).toEqual({ type: 'paragraph', text: '' });
    expect(createEmptyBlock('image')).toEqual({ type: 'image', src: '', alt: '' });
    expect(createEmptyBlock('cta')).toEqual({ type: 'cta', label: '', url: '' });
  });
});
