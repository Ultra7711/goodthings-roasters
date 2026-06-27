/* ══════════════════════════════════════════
   FullscreenLoader — 전체 화면 로딩 오버레이
   소셜 로그인 진행·OAuth 콜백 처리 등 "이동/처리 중" 구간 공통 로더.
   기존 LoginPage auth-overlay(텍스트 위주·스피너 미시인)를 대체.
   스피너 = 공통 Spinner(히어로 디자인) · 컬러 = 골드(라이트 오버레이 대비).
   ══════════════════════════════════════════ */

'use client';

import './FullscreenLoader.css';
import { Spinner } from './Spinner';

type FullscreenLoaderProps = {
  /** 스피너 아래 안내 문구 (선택). 없으면 스피너만. */
  label?: string;
};

export function FullscreenLoader({ label }: FullscreenLoaderProps) {
  return (
    <div
      className="gtr-fs-loader"
      role="status"
      aria-live="polite"
      /* backdrop-filter 는 Lightning CSS 가 CSS 파일에서 드롭하므로 inline 주입(웹 lessons §6). */
      style={{
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <Spinner size={40} />
      {label && <p className="gtr-fs-loader-txt">{label}</p>}
    </div>
  );
}
