/* ══════════════════════════════════════════════════════════════════════════
   admin/newsletterCompose.ts — 뉴스레터 발송 컴포저 블록 타입·검증 (S250-2 Phase 2)

   - 컴포저(NewsletterComposer)와 발송 액션(actions)·렌더러(newsletterEmail)가
     공유하는 순수 레이어. client + server 모두 import (node 의존 없음).
   - 블록 = discriminated union (heading / paragraph / image / cta).
   - 이미지 src 는 우리 Storage newsletter-images public URL 만 허용
     (외부 이미지·추적 픽셀·SSRF 차단). 업로드 액션이 반환한 getPublicUrl 만 사용.
   - CTA url / image href 는 https 스킴만 허용 (javascript:·data: 인젝션 차단).
   ══════════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

export const NEWSLETTER_MAX_BLOCKS = 20;
export const NEWSLETTER_SUBJECT_MAX = 120;
export const NEWSLETTER_HEADING_MAX = 120;
export const NEWSLETTER_PARAGRAPH_MAX = 2000;
export const NEWSLETTER_CTA_LABEL_MAX = 40;
export const NEWSLETTER_IMAGE_ALT_MAX = 120;

export type NewsletterBlockType = 'heading' | 'paragraph' | 'image' | 'cta';

export const NEWSLETTER_BLOCK_LABEL: Record<NewsletterBlockType, string> = {
  heading: '제목',
  paragraph: '문단',
  image: '이미지',
  cta: '버튼(CTA)',
};

/* 우리 Storage newsletter-images public URL 만 허용.
   getPublicUrl 형식: <SUPABASE_URL>/storage/v1/object/public/newsletter-images/... */
const NEWSLETTER_IMAGE_PATH = '/storage/v1/object/public/newsletter-images/';

export function isNewsletterImageUrl(url: string): boolean {
  return url.startsWith('https://') && url.includes(NEWSLETTER_IMAGE_PATH);
}

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith('https://'), 'must be https');

const headingBlockSchema = z.object({
  type: z.literal('heading'),
  text: z.string().trim().min(1).max(NEWSLETTER_HEADING_MAX),
});

const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().trim().min(1).max(NEWSLETTER_PARAGRAPH_MAX),
});

const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z
    .string()
    .trim()
    .url()
    .refine(isNewsletterImageUrl, 'must be a newsletter-images URL'),
  alt: z.string().trim().max(NEWSLETTER_IMAGE_ALT_MAX).default(''),
  href: httpsUrl.optional(),
});

const ctaBlockSchema = z.object({
  type: z.literal('cta'),
  label: z.string().trim().min(1).max(NEWSLETTER_CTA_LABEL_MAX),
  url: httpsUrl,
});

export const newsletterBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  paragraphBlockSchema,
  imageBlockSchema,
  ctaBlockSchema,
]);

export type NewsletterBlock = z.infer<typeof newsletterBlockSchema>;

export const newsletterDraftSchema = z.object({
  subject: z.string().trim().min(1).max(NEWSLETTER_SUBJECT_MAX),
  blocks: z.array(newsletterBlockSchema).min(1).max(NEWSLETTER_MAX_BLOCKS),
});

export type NewsletterDraft = z.infer<typeof newsletterDraftSchema>;

/* UI 편집용 빈 블록 팩토리 (컴포저에서 "블록 추가" 시 사용). */
export function createEmptyBlock(type: NewsletterBlockType): NewsletterBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: '' };
    case 'paragraph':
      return { type: 'paragraph', text: '' };
    case 'image':
      return { type: 'image', src: '', alt: '' };
    case 'cta':
      return { type: 'cta', label: '', url: '' };
  }
}
