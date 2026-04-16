/* ══════════════════════════════════════════════════════════════════════════
   sendEmail.test.ts — 이메일 공통 레이어 단위 테스트 (Session 7 B-D)

   사양: docs/email-infrastructure.md §9

   테스트 케이스 (15):
     [config] 1~4     — 환경변수 판정 + fail-fast 가드
     [stub]   5~7     — 페이로드 검증 실패·정상·마스킹
     [live]   8~12    — 정상·429·401·500·네트워크 에러
     [live]   13      — idempotencyKey SDK 공식 필드 전달 확인
     [rate]   14~15   — 토큰버킷 직렬화 + 내부 재시도 없음

   Mock 전략: vi.mock('resend', ...) 로 Resend 클래스 교체.
   ════════════════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ─── Resend SDK mock — import 보다 먼저 선언 (hoisting) ──────────────── */

// vi.hoisted 로 변수를 palette 에 올려야 resetModules 후에도 동일 인스턴스 유지.
// class 형태로 mock 해야 `new Resend()` 생성자 호출이 성공한다.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

/* ─── env 스냅샷 / 복구 헬퍼 ───────────────────────────────────────────── */

const ENV_KEYS = [
  'NODE_ENV',
  'EMAIL_MODE',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_REPLY_TO',
  'RESEND_RPS',
] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<
    (typeof ENV_KEYS)[number],
    string | undefined
  >;
}

// NODE_ENV 가 readonly 로 선언된 @types/node 환경을 우회하기 위한 얇은 헬퍼.
// 런타임 process.env 는 일반 객체 — 할당 가능하다.
type MutableEnv = Record<string, string | undefined>;

function restoreEnv(snap: Record<(typeof ENV_KEYS)[number], string | undefined>) {
  const env = process.env as MutableEnv;
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete env[k];
    else env[k] = snap[k];
  }
}

function setEnv(patch: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  const env = process.env as MutableEnv;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
}

/* ─── 모듈 재로드 헬퍼 ──────────────────────────────────────────────────
   config / client 싱글톤이 모듈 레벨에 캐시되므로, env 변경을 반영하려면
   vi.resetModules() 후 동적 import 해야 한다. */

async function freshImport() {
  await vi.resetModules();
  const mod = await import('./sendEmail');
  return mod;
}

/* ─── 테스트 스위트 ──────────────────────────────────────────────────── */

let envSnap: ReturnType<typeof snapshotEnv>;

beforeEach(() => {
  envSnap = snapshotEnv();
  sendMock.mockReset();
  // 기본은 모든 env 를 비운다 → 각 케이스에서 필요한 것만 주입.
  const env = process.env as MutableEnv;
  for (const k of ENV_KEYS) delete env[k];
});

afterEach(() => {
  restoreEnv(envSnap);
});

/* ─────────── config ─────────── */

describe('config', () => {
  it('[1] NODE_ENV=production + RESEND_API_KEY 없음 → not_configured 로 throw', async () => {
    setEnv({ NODE_ENV: 'production' });
    const { sendEmail } = await freshImport();
    await expect(
      sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' }),
    ).rejects.toThrow(/RESEND_API_KEY is required/);
  });

  it('[2] EMAIL_MODE=stub + production → 부트 throw (security H-2)', async () => {
    // 운영에서 stub override 를 원천 차단. 누군가 env 를 실수로 잘못 심어도
    // 주문 확인·발송 알림 메일이 침묵 실패하지 않도록 앱이 올라오지 않게 한다.
    setEnv({ NODE_ENV: 'production', EMAIL_MODE: 'stub' });
    const { sendEmail } = await freshImport();
    await expect(
      sendEmail({ to: 'u@x.com', subject: 's', text: 'hi' }),
    ).rejects.toThrow(/EMAIL_MODE=stub is not allowed in production/);
  });

  it('[3] EMAIL_MODE=auto + dev + API 키 있음 → live 모드', async () => {
    setEnv({
      NODE_ENV: 'development',
      EMAIL_MODE: 'auto',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM_EMAIL: 'from@x.com',
    });
    sendMock.mockResolvedValue({ data: { id: 'e-live-3' }, error: null });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', text: 'hi' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe('live');
  });

  it('[4] EMAIL_MODE=auto + dev + 키 없음 → stub 모드', async () => {
    setEnv({ NODE_ENV: 'development', EMAIL_MODE: 'auto' });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', text: 'hi' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe('stub');
    expect(sendMock).not.toHaveBeenCalled();
  });
});

/* ─────────── stub ─────────── */

describe('stub', () => {
  beforeEach(() => {
    setEnv({ EMAIL_MODE: 'stub' });
  });

  it('[5] to 누락 → invalid_payload (stub 에서도 검증 실패 반환)', async () => {
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: '', subject: 's', text: 'hi' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('invalid_payload');
      expect(r.error.retryable).toBe(false);
    }
  });

  it('[6] 정상 페이로드 → { ok: true, id: stub-*, mode: stub }', async () => {
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'user@example.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.id).toMatch(/^stub-[0-9a-f]{8}/);
      expect(r.mode).toBe('stub');
    }
  });

  it('[7] 콘솔 로그에 이메일 마스킹 적용 — 원본 미포함', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await freshImport();
    await sendEmail({ to: 'johndoe@example.com', subject: 'hi', text: 'body' });
    const printed = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(printed).toContain('j***@example.com');
    expect(printed).not.toContain('johndoe@example.com');
    logSpy.mockRestore();
  });

  it('[7-a] security H-1: 로그에 subject 원문 없음 · subjectLen 만 기록', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await freshImport();
    const sensitiveSubject = '주문번호 GTR-20260417-0001 결제가 완료되었습니다';
    await sendEmail({ to: 'u@example.com', subject: sensitiveSubject, text: 'body' });
    const printed = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(printed).not.toContain(sensitiveSubject);
    expect(printed).not.toContain('GTR-20260417-0001');
    expect(printed).toMatch(new RegExp(`subjectLen=${sensitiveSubject.length}`));
    logSpy.mockRestore();
  });

  it('[7-b] security M-3: idempotencyKey 형식 불일치 → invalid_payload', async () => {
    const { sendEmail } = await freshImport();
    const r = await sendEmail({
      to: 'u@example.com',
      subject: 's',
      text: 'hi',
      // 공백 + 개행 + 제어문자 → 정규식 거부 (로그 인젝션 · 외부 저장소 키 방어)
      idempotencyKey: 'order confirm\n GTR-001',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('invalid_payload');
      expect(r.error.retryable).toBe(false);
    }
  });

  it('[7-c] security M-1: idempotencyKey 로그 truncate (12자) + JSON.stringify', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendEmail } = await freshImport();
    // 13자 이상 — truncate 동작 확인. slice(0,12)='order-confir' + `…` 말줄임.
    await sendEmail({
      to: 'u@example.com',
      subject: 's',
      text: 'hi',
      idempotencyKey: 'order-confirm:GTR-20260417-001',
    });
    const printed = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(printed).toContain('idempotencyKey="order-confir…"');
    expect(printed).not.toContain('GTR-20260417-001');
    expect(printed).not.toContain('order-confirm:'); // 원문 콜론 이후 부분 유출 차단 확인
    logSpy.mockRestore();
  });
});

/* ─────────── live ─────────── */

describe('live', () => {
  beforeEach(() => {
    setEnv({
      EMAIL_MODE: 'live',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM_EMAIL: 'from@x.com',
      RESEND_RPS: '100',
    });
  });

  it('[8] 정상 응답 → { ok: true, id, mode: live }', async () => {
    sendMock.mockResolvedValue({ data: { id: 're-id-8' }, error: null });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.id).toBe('re-id-8');
  });

  it('[9] 429 응답 → rate_limit_exceeded, retryable=true', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', statusCode: 429, message: '429' },
    });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('rate_limit_exceeded');
      expect(r.error.retryable).toBe(true);
    }
  });

  it('[10] 401 응답 → auth_failed, retryable=false', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'invalid_api_key', statusCode: 401, message: 'bad key' },
    });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('auth_failed');
      expect(r.error.retryable).toBe(false);
    }
  });

  it('[11] 500 응답 → provider_error, retryable=true', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'internal_server_error', statusCode: 500, message: 'oops' },
    });
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('provider_error');
      expect(r.error.retryable).toBe(true);
    }
  });

  it('[12] fetch throw → network_error, retryable=true', async () => {
    sendMock.mockRejectedValue(new Error('ECONNRESET'));
    const { sendEmail } = await freshImport();
    const r = await sendEmail({ to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('network_error');
      expect(r.error.retryable).toBe(true);
    }
  });

  it('[13] idempotencyKey 는 SDK 2nd arg options 로 전달된다', async () => {
    sendMock.mockResolvedValue({ data: { id: 're-id-13' }, error: null });
    const { sendEmail } = await freshImport();
    await sendEmail({
      to: 'u@x.com',
      subject: 's',
      html: '<p>h</p>',
      idempotencyKey: 'order-confirm:GTR-001',
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [, options] = sendMock.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: 'order-confirm:GTR-001' });
  });
});

/* ─────────── rate limiter ─────────── */

describe('rate limiter', () => {
  beforeEach(() => {
    setEnv({
      EMAIL_MODE: 'live',
      RESEND_API_KEY: 'test-key',
      RESEND_FROM_EMAIL: 'from@x.com',
      RESEND_RPS: '5',
    });
  });

  it('[14] capacity(5) 초과 호출 → 6번째 호출 지연 발생', async () => {
    sendMock.mockImplementation(() =>
      Promise.resolve({ data: { id: `re-${Math.random()}` }, error: null }),
    );
    const { sendEmail } = await freshImport();

    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        sendEmail({ to: 'u@x.com', subject: 's', text: 'hi' }),
      ),
    );
    const elapsed = Date.now() - start;

    expect(results.every((r) => r.ok)).toBe(true);
    // 6번째 호출은 최소 1/5 초(200ms) 대기 후 실행되어야 함 (타이밍 여유 150ms 이상 기대)
    expect(elapsed).toBeGreaterThanOrEqual(150);
  });

  it('[15] Resend 429 반환 시 내부 재시도 없음 (1회만 호출)', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'rate_limit_exceeded', statusCode: 429, message: '429' },
    });
    const { sendEmail } = await freshImport();
    await sendEmail({ to: 'u@x.com', subject: 's', text: 'hi' });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
