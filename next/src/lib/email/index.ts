/* ══════════════════════════════════════════════════════════════════════════
   email/index.ts — 공개 API 재노출

   사양: docs/email-infrastructure.md §3.1
   ════════════════════════════════════════════════════════════════════════ */

export { sendEmail } from './sendEmail';
export { EmailError, normalizeResendError } from './errors';
export { getEmailConfig } from './config';
export type { EmailPayload, EmailResult, EmailMode, EmailErrorCode, EmailErrorShape } from './types';
