/* ══════════════════════════════════════════════════════════════════════════
   csrf.ts — Origin 헤더 기반 CSRF 방어 (P2-A Pass 1 H-2)

   방어 모델:
   - 세션 쿠키가 `SameSite=Lax` 인 환경에서도 대부분의 CSRF 를 차단하지만
     (Supabase SSR 은 Lax 가 기본), POST/PUT/PATCH/DELETE 요청에 대해
     Origin/Referer 헤더를 교차 검증하는 방어 1 겹을 추가한다.
   - 정책:
       1) 동일 Origin → 통과
       2) Origin 헤더 누락 + Referer 헤더로 대체 검증
       3) ALLOWED_ORIGINS 에 포함 → 통과 (서브도메인·프리뷰 배포 대응)
       4) 그 외 → 403 forbidden

   배포 환경:
   - Vercel 프로덕션: NEXT_PUBLIC_SITE_URL (e.g. https://goodthings-roasters.com)
   - Vercel 프리뷰:   VERCEL_URL (자동)
   - 로컬 개발:       http://localhost:3000 / http://127.0.0.1:3000

   참고: OWASP ASVS §4.2.2, §13.2.3
   ══════════════════════════════════════════════════════════════════════════ */

import { apiError } from './errors';

/* ══════════════════════════════════════════
   CSRF 화이트리스트 (외부 발신자 엔드포인트)
   ══════════════════════════════════════════
   - Toss 웹훅: 외부 서버가 호출 → Origin 헤더 부재/상이 정상. 대신 카드=GET
     재조회, 가상계좌=per-payment secret timing-safe 비교로 방어 (ADR-002).
   - 경로는 `URL.pathname` 으로만 비교 (쿼리·호스트 무관). 신규 외부 엔드포인트
     추가 시에만 이 목록을 확장한다.

   참조: docs/payments-flow.md §6.1
   ══════════════════════════════════════════ */

const CSRF_EXEMPT_PATHS: ReadonlySet<string> = new Set<string>([
  '/api/payments/webhook',
]);

/**
 * CSRF Origin 검증을 건너뛸 경로 prefix.
 * - `/api/admin/` : 어드민 API 키(x-admin-secret) 검증 경로 — 브라우저 호출이 아니므로
 *   Origin 이 없거나 다른 호스트일 수 있음. 인증은 timing-safe 비교로 대체 (Session 8-B).
 */
const CSRF_EXEMPT_PREFIXES: readonly string[] = ['/api/admin/'];

function isCsrfExemptPath(request: Request): boolean {
  try {
    const pathname = new URL(request.url).pathname;
    if (CSRF_EXEMPT_PATHS.has(pathname)) return true;
    return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

/* ── 허용 Origin 수집 ──────────────────────────────────────────────── */

function collectAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  /* 명시 설정된 사이트 URL */
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.add(normalizeOrigin(siteUrl));

  /* Vercel 자동 제공 (프리뷰 배포 URL) */
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) origins.add(normalizeOrigin(`https://${vercelUrl}`));

  /* 로컬 개발 */
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

function normalizeOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

/* 요청 자체의 origin (same-origin check 최후 fallback) */
function requestOrigin(request: Request): string | null {
  try {
    const u = new URL(request.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/* ── 헤더에서 origin 추출 ─────────────────────────────────────────── */

function extractOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (origin) return normalizeOrigin(origin);

  /* Origin 이 비어있는 경우 Referer 로 fallback (iOS WebView 등) */
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }

  return null;
}

/* ══════════════════════════════════════════
   Public API
   ══════════════════════════════════════════ */

/**
 * 요청의 Origin 이 허용 목록에 속하는지 순수 검사 (테스트용).
 *
 * @returns true = 허용 / false = 차단
 */
export function isOriginAllowed(
  request: Request,
  allowed: Iterable<string>,
): boolean {
  const origin = extractOrigin(request);
  const selfOrigin = requestOrigin(request);
  const allowedSet = new Set([...allowed, ...(selfOrigin ? [selfOrigin] : [])]);

  /* Origin/Referer 모두 부재:
     - SameSite=Lax 쿠키는 top-level GET/navigation 만 전달됨 → POST 는 거의 항상
       Origin 이 존재. 부재 상황은 curl 등 비브라우저 / 서버-투-서버 호출 가능성 →
       이 경우 차단한다. */
  if (!origin) return false;

  return allowedSet.has(origin);
}

/**
 * Route Handler 에서 사용하는 CSRF 가드.
 *
 * @returns 403 Response (차단) 혹은 null (통과)
 *
 * @example
 *   const blocked = enforceSameOrigin(request);
 *   if (blocked) return blocked;
 */
export function enforceSameOrigin(request: Request): Response | null {
  /* 외부 발신자 엔드포인트(Toss 웹훅 등) 는 Origin 검증 불가 — 별도 인증 사용. */
  if (isCsrfExemptPath(request)) return null;

  const allowed = collectAllowedOrigins();
  if (isOriginAllowed(request, allowed)) return null;
  return apiError('forbidden', { detail: 'origin_not_allowed' });
}
