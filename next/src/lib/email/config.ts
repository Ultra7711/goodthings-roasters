/* ══════════════════════════════════════════════════════════════════════════
   email/config.ts — 환경변수 파싱 + 런타임 가드

   사양: docs/email-infrastructure.md §5

   2026-04-17 Pass 1 수정:
     - security H-2: EMAIL_MODE=stub + NODE_ENV=production 조합 부트 throw.
       프로덕션은 항상 live 여야 하므로 명시 override 도 차단. 누군가 .env
       변수를 실수로 prod 에 심어도 앱이 뜨지 않도록 방어.
   ════════════════════════════════════════════════════════════════════════ */

import type { EmailMode } from './types';

export type EmailConfig = {
  mode: EmailMode;
  apiKey: string | null;
  fromEmail: string;
  replyTo: string | null;
  rps: number;
};

const DEFAULT_RPS = 5; // Context7 재검증: Resend 팀당 기본 5 req/s (docs §2.1)
const STUB_FROM_FALLBACK = 'onboarding@resend.dev';

let cached: EmailConfig | null = null;

/**
 * EMAIL_MODE=auto 판정 로직 (docs §5.2):
 *   1) EMAIL_MODE 명시 → 그대로
 *   2) NODE_ENV=production → live (API 키 없으면 부트 시점에 throw)
 *   3) RESEND_API_KEY 있음 → live
 *   4) 그 외 → stub
 */
function resolveMode(raw: string | undefined, nodeEnv: string | undefined, apiKey: string | null): EmailMode {
  if (raw === 'live' || raw === 'stub') return raw;
  if (nodeEnv === 'production') return 'live';
  return apiKey ? 'live' : 'stub';
}

/**
 * 환경변수 파싱 + 검증. 부트 타임에 최초 호출되어 cached 에 저장된다.
 * 프로덕션 + live 모드에서 API 키 누락 시 즉시 throw → 침묵 실패 방지.
 *
 * 테스트에서 env 변경을 반영하려면 resetEmailConfigForTests() 후 재호출.
 */
export function getEmailConfig(): EmailConfig {
  if (cached) return cached;

  const rawMode = process.env.EMAIL_MODE?.trim();
  const apiKeyRaw = process.env.RESEND_API_KEY?.trim();
  const apiKey = apiKeyRaw && apiKeyRaw.length > 0 ? apiKeyRaw : null;
  const mode = resolveMode(rawMode, process.env.NODE_ENV, apiKey);

  // security H-2: stub 모드는 프로덕션에서 원천 차단.
  // 운영 환경에서 실제 메일이 안 나가는 상황은 주문 확인·발송 알림 등
  // 비즈니스 크리티컬 통신을 침묵시킨다. EMAIL_MODE=stub 이 실수로 prod env 에
  // 주입되더라도 앱이 부트 시점에 크래시하도록 한다.
  if (mode === 'stub' && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[email] EMAIL_MODE=stub is not allowed in production. ' +
        'Remove the override or set EMAIL_MODE=live with a valid RESEND_API_KEY.',
    );
  }

  if (mode === 'live' && !apiKey) {
    throw new Error(
      '[email] RESEND_API_KEY is required in live mode. ' +
        'Set EMAIL_MODE=stub for local dev, or provide the API key.',
    );
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    (mode === 'stub' ? STUB_FROM_FALLBACK : '');

  if (mode === 'live' && !fromEmail) {
    throw new Error(
      '[email] RESEND_FROM_EMAIL is required in live mode. ' +
        'Configure a verified sender address.',
    );
  }

  const replyTo = process.env.RESEND_REPLY_TO?.trim() || null;

  const rpsRaw = process.env.RESEND_RPS?.trim();
  const rpsParsed = rpsRaw ? Number.parseInt(rpsRaw, 10) : NaN;
  const rps = Number.isFinite(rpsParsed) && rpsParsed > 0 ? rpsParsed : DEFAULT_RPS;

  cached = { mode, apiKey, fromEmail, replyTo, rps };
  return cached;
}

/** 테스트 전용 — 캐시 초기화. 프로덕션 코드에서 호출 금지. */
export function resetEmailConfigForTests(): void {
  cached = null;
}
