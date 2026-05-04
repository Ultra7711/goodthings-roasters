'use client';

/* ══════════════════════════════════════════
   SRInitializerClient — /preview/* 전용 client wrapper

   책임:
   - SRInitializer 를 dynamic({ ssr: false }) 로 로드 → hydration 완료 후 mount.
   - 미리보기는 viewport 가 콘텐츠로 가득 차 IO 가 즉시 sr--visible 추가하면서
     hydration mismatch (server HTML vs client DOM) 잡히는 dev console warning 회피.
   - Next.js 16 규격: ssr:false 는 server component 에서 허용 안 됨 → client wrapper 필수.

   메인 사이트는 SRInitializer 를 그대로 SSR 포함 (첫 paint 깜빡임 회피).
   미리보기 한정 분기.
   ══════════════════════════════════════════ */

import dynamic from 'next/dynamic';

const SRInitializer = dynamic(
  () => import('@/components/layout/SRInitializer'),
  { ssr: false },
);

export default function SRInitializerClient() {
  return <SRInitializer />;
}
