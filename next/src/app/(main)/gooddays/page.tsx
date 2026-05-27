/* ══════════════════════════════════════════
   Good Days Route — /gooddays
   - Server component: searchParams.img 을 prop 으로 받아 GoodDaysPage 에 전달.
   - DB fetch (S167 J-3): fetchGoodDaysGallery() — is_active=true 만, sort_order asc.
   - Suspense fallback 은 cream 본문과 동일 톤(투명 + min-height) — 메뉴 드로어 등 ?img= 없는
     진입 시 검정 fallback → cream 본문 플래시 차단. ?img= 진입 시는 메인 GoodDaysSection 의
     body.gd-route-transition 오버레이 가 cream 단절 차단 (이 fallback 위에 검정 풀로 깔림).
   - 헤더 테마 light, headerThemeConfig 에 등록.
   ══════════════════════════════════════════ */

import { Suspense } from 'react';
import { connection } from 'next/server';
import GoodDaysPage from '@/components/gooddays/GoodDaysPage';
import { fetchGoodDaysGallery } from '@/lib/gooddaysServer';

export const metadata = { title: '좋은 순간들' };

type Props = {
  searchParams: Promise<{ img?: string }>;
};

async function GoodDaysContent({ searchParams }: Props) {
  /* S279-D · DEC-S279-D-1: gooddaysServer 'use cache' 폐기로 caller 측
     connection() 명시 — admin 변경 즉시 /gooddays 반영 보장. searchParams
     의 dynamic 과 idempotent — 안전망. */
  await connection();
  const [params, gallery] = await Promise.all([searchParams, fetchGoodDaysGallery()]);
  return <GoodDaysPage initialImgSrc={params.img ?? null} gallery={gallery} />;
}

export default function GoodDaysRoute({ searchParams }: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100svh' }} aria-hidden="true" />}>
      <GoodDaysContent searchParams={searchParams} />
    </Suspense>
  );
}
