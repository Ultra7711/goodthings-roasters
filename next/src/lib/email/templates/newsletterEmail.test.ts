/* ══════════════════════════════════════════
   newsletterEmail.test.ts — 캠페인 렌더러 (S250-2 Phase 2)
   ══════════════════════════════════════════ */

import { describe, expect, it } from 'vitest';
import { renderNewsletterEmail } from './newsletterEmail';
import type { NewsletterBlock } from '@/lib/admin/newsletterCompose';

const TOKEN = '11111111-2222-3333-4444-555555555555';
const IMG = 'https://proj.supabase.co/storage/v1/object/public/newsletter-images/nl-1.webp';

describe('renderNewsletterEmail', () => {
  it('subject·html·text 반환', () => {
    const out = renderNewsletterEmail({
      subject: '제목줄',
      blocks: [{ type: 'paragraph', text: '안녕하세요' }],
      unsubscribeToken: TOKEN,
    });
    expect(out.subject).toBe('제목줄');
    expect(out.html).toContain('<!DOCTYPE html>');
    expect(out.html).toContain('안녕하세요');
    expect(out.text).toContain('안녕하세요');
  });

  it('구독취소 URL 에 토큰 포함', () => {
    const out = renderNewsletterEmail({
      subject: 's',
      blocks: [{ type: 'paragraph', text: 'p' }],
      unsubscribeToken: TOKEN,
    });
    expect(out.html).toContain(`/unsubscribe?token=${TOKEN}`);
    expect(out.text).toContain(`/unsubscribe?token=${TOKEN}`);
  });

  it('heading·paragraph·cta·image 블록 모두 렌더', () => {
    const blocks: NewsletterBlock[] = [
      { type: 'heading', text: '큰제목' },
      { type: 'paragraph', text: '문단' },
      { type: 'cta', label: '둘러보기', url: 'https://goodthingsroasters.com' },
      { type: 'image', src: IMG, alt: '대체텍스트' },
    ];
    const out = renderNewsletterEmail({ subject: 's', blocks, unsubscribeToken: TOKEN });
    expect(out.html).toContain('큰제목');
    expect(out.html).toContain('문단');
    expect(out.html).toContain('둘러보기');
    expect(out.html).toContain('https://goodthingsroasters.com');
    expect(out.html).toContain(IMG);
    expect(out.html).toContain('대체텍스트');
  });

  it('이미지 href 있으면 <a> 로 감싼다', () => {
    const out = renderNewsletterEmail({
      subject: 's',
      blocks: [{ type: 'image', src: IMG, alt: '', href: 'https://goodthingsroasters.com/shop' }],
      unsubscribeToken: TOKEN,
    });
    expect(out.html).toContain('href="https://goodthingsroasters.com/shop"');
  });

  it('XSS — heading/paragraph 의 HTML 이스케이프', () => {
    const out = renderNewsletterEmail({
      subject: 's',
      blocks: [
        { type: 'heading', text: '<script>alert(1)</script>' },
        { type: 'paragraph', text: '<img onerror=x>' },
      ],
      unsubscribeToken: TOKEN,
    });
    expect(out.html).not.toContain('<script>alert(1)</script>');
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).toContain('&lt;img onerror=x&gt;');
  });

  it('문단 줄바꿈 → <br>', () => {
    const out = renderNewsletterEmail({
      subject: 's',
      blocks: [{ type: 'paragraph', text: '첫줄\n둘째줄' }],
      unsubscribeToken: TOKEN,
    });
    expect(out.html).toContain('첫줄<br>둘째줄');
  });
});
