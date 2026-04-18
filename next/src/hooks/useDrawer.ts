/* ══════════════════════════════════════════
   useDrawer (RP-5 / 2026-04-12)
   우측 슬라이드인 드로어 공통 로직.
   - ESC 키 닫기
   - 드로어 오픈 동안 body scroll lock
   상세 드로어 패턴: memory/feedback_drawer_pattern.md
   ══════════════════════════════════════════ */

import { useEffect } from 'react';

type UseDrawerArgs = {
  /** 드로어 오픈 상태 */
  open: boolean;
  /** ESC 키 수신 시 호출 */
  onClose: () => void;
};

/**
 * 우측 슬라이드인 드로어(영양정보, 장바구니 등)의 공통 부수효과를 관리한다.
 *
 * - ESC 키로 onClose 호출
 * - open 동안 `document.body.style.overflow = 'hidden'` 로 scroll lock,
 *   언마운트/닫힘 시 이전 값 복구
 *
 * 새 드로어 추가 시 이 훅만 호출하면 두 동작이 자동으로 붙는다.
 */
export function useDrawer({ open, onClose }: UseDrawerArgs): void {
  // ESC 키 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // body scroll lock — 드로어 오픈 동안 + scrollbar-gutter 일시 해제
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = document.body.style.overflow;
    const prevGutter = html.style.scrollbarGutter;
    // html { scrollbar-gutter: stable } 를 auto 로 해제 → ICB 가 전체 viewport 로 확장,
    // fixed 드로어 패널의 right:0 이 true viewport 우측 끝에 정렬됨.
    // 뒤쪽 콘텐츠는 backdrop 으로 덮이므로 gutter 해제로 인한 시프트가 보이지 않음.
    html.style.scrollbarGutter = 'auto';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      html.style.scrollbarGutter = prevGutter;
    };
  }, [open]);
}
