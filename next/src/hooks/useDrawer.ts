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

  // body scroll lock — 드로어 오픈 동안
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}
