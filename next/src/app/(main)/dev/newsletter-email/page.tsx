/* ══════════════════════════════════════════
   /dev/newsletter-email — newsletter welcome 메일 template 미리보기 (S241)

   dev 환경에서 메일 HTML 시각 검증. 실제 발송은 Phase 3.
   client component — Next.js 16 cacheComponents 의 server-side `new Date()` 차단 회피
   (template 내 © year 표시용 new Date()).
   ══════════════════════════════════════════ */

'use client';

import { renderNewsletterWelcomeEmail } from '@/lib/email/templates/newsletterWelcomeEmail';

export default function NewsletterEmailPreview() {
  const { html } = renderNewsletterWelcomeEmail({
    unsubscribeToken: '11111111-2222-3333-4444-555555555555',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#999',
        padding: '24px',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: '#fff',
          padding: '12px',
          borderRadius: '4px',
        }}
      >
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
          ⚠ Newsletter Welcome Email 미리보기 (dev only · 실제 발송은 Phase 3)
        </p>
        <iframe
          srcDoc={html}
          style={{
            width: '100%',
            height: '900px',
            border: '1px solid #ddd',
            background: '#fff',
          }}
          title="newsletter-welcome-email"
        />
      </div>
    </div>
  );
}
