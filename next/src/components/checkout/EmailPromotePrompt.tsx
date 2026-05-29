/* ══════════════════════════════════════════
   EmailPromotePrompt — 주문 완료 후 이메일 계정 승격 제안 (S302 · DEC-E4)

   로그인된 가상 이메일(간편로그인) 회원에게 "이 이메일을 계정에 등록" 제안.
   useEmailRegisterForm 재사용 (마이페이지 등록과 동일 Supabase email-change 링크 플로우).
   비회원·이미 실이메일 회원은 부모(OrderCompletePage)에서 미렌더.
   order-complete 의 editorial 스타일 일관성 위해 raw input 사용 (TextField 미사용).
   ══════════════════════════════════════════ */

'use client';

import { useEmailRegisterForm } from '@/hooks/useEmailRegisterForm';

type Props = {
  /** 주문 시 입력한 contact 이메일 (prefill · 없으면 빈 값) */
  initialEmail?: string;
};

export default function EmailPromotePrompt({ initialEmail = '' }: Props) {
  const form = useEmailRegisterForm({ initialEmail });

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'var(--font-kr)',
    fontSize: 'var(--type-body-m-size)',
    color: 'var(--color-text-primary)',
    background: 'var(--color-bg-primary)',
    border: '1px solid var(--color-line-light)',
    borderRadius: 8,
    outline: 'none',
  } as const;

  return (
    <section
      style={{
        marginTop: 8,
        padding: '24px',
        background: 'var(--color-bg-secondary)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-kr)',
            fontSize: 'var(--type-body-l-size)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          이메일을 계정에 등록하세요
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-kr)',
            fontSize: 'var(--type-body-s-size)',
            color: 'var(--color-text-secondary)',
            margin: '6px 0 0',
          }}
        >
          간편로그인 계정에 이메일이 없습니다. 등록하면 주문 알림을 받고 계정을 안전하게 복구할 수 있어요.
        </p>
      </div>

      {form.sent ? (
        <p
          style={{
            fontFamily: 'var(--font-kr)',
            fontSize: 'var(--type-body-s-size)',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}
        >
          <strong>{form.email}</strong> 로 확인 메일을 보냈습니다. 메일의 링크를 클릭하면 등록이 완료됩니다.
        </p>
      ) : (
        <>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="이메일 주소"
            placeholder="example@domain.com"
            value={form.email}
            disabled={form.isLoading}
            onChange={(e) => form.setEmail(e.target.value)}
            onBlur={form.blurEmail}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !form.isLoading) void form.submit();
            }}
            style={inputStyle}
          />
          {form.error && (
            <p
              style={{
                fontFamily: 'var(--font-kr)',
                fontSize: 'var(--type-body-s-size)',
                color: 'var(--color-error, #c0392b)',
                margin: 0,
              }}
            >
              {form.error}
            </p>
          )}
          <button
            className="ocp-btn-primary"
            type="button"
            disabled={form.isLoading}
            onClick={() => void form.submit()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            data-gtr-tap
          >
            {form.isLoading ? '발송 중…' : '확인 메일 보내기'}
          </button>
        </>
      )}
    </section>
  );
}
