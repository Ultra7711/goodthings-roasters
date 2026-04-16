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
  const allowed = collectAllowedOrigins();
  if (isOriginAllowed(request, allowed)) return null;
  return apiError('forbidden', { detail: 'origin_not_allowed' });
}
