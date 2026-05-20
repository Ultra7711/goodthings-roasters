/* ══════════════════════════════════════════
   NewsletterSection (V2 §2.7 — Footer 직전 CTA)
   - 자문 §0 핵심결정 메인 5섹션 마지막 dark CTA
   - bg --ink-section (Story Stage 2 통일)
   - submit = subscribeNewsletter server action (S241 D-25 · Phase 1)
   - 회원이면 user_id 자동 연결 (cookies 인증) · 비회원이면 user_id null
   - Phase 2: 마이페이지 토글 / Phase 3: Resend 발송 + admin
   ══════════════════════════════════════════ */

'use client';

import {
  useState,
  useTransition,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { z } from 'zod';
import { subscribeNewsletter } from '@/lib/newsletter';

const emailSchema = z.string().trim().email();

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (error) setError(null);
    if (success) setSuccess(false);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError('올바른 이메일 주소를 입력해주세요');
      return;
    }
    startTransition(async () => {
      const res = await subscribeNewsletter(email);
      if (res.ok) {
        setSuccess(true);
        setEmail('');
        return;
      }
      if (res.error === 'invalid_email') {
        setError('올바른 이메일 주소를 입력해주세요');
      } else if (res.error === 'already_subscribed') {
        setError('이미 구독 중인 이메일입니다');
      } else {
        setError('일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
      }
    });
  }

  return (
    <section className="blk newsletter-section" data-header-theme="dark" data-sr>
      <div className="newsletter-inner">
        <span className="blk-label blk-label--on-dark sr-txt sr-txt--d1" data-sr-eyebrow>NEWSLETTER</span>
        <h2 className="newsletter-h sr-txt sr-txt--d2">계절이 바뀌면 알려드립니다</h2>
        <p className="newsletter-body sr-txt sr-txt--d3">
          시즌 원두 출시 · 매장 소식 · 정기배송 안내
        </p>
        <form className="newsletter-form sr-txt sr-txt--d4" onSubmit={handleSubmit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className="newsletter-input"
            placeholder="이메일 주소"
            value={email}
            onChange={handleChange}
            aria-label="이메일 주소"
            aria-invalid={!!error}
          />
          <button
            type="submit"
            className="newsletter-btn"
            data-gtr-tap
            disabled={isPending}
          >
            {isPending ? '처리 중…' : '구독'}
          </button>
        </form>
        {error && (
          <span className="newsletter-msg newsletter-msg--error" role="alert">
            {error}
          </span>
        )}
        {success && (
          <span className="newsletter-msg newsletter-msg--success" role="status">
            구독 신청이 완료되었습니다
          </span>
        )}
      </div>
    </section>
  );
}
