'use client';

/* ══════════════════════════════════════════════════════════════════════════
   PdpDirtyContext — /admin/products/[slug]/edit 통합 dirty 관리 (S251 Phase 3b)

   목적:
   - 같은 페이지의 ProductEditForm + ProductImageReorderClient 가 분리되어 있어
     각자 dirty 사이클 + 저장 버튼을 가지면 PDP 에 [저장][취소] 셋트가 2개 노출됨.
   - 통합 = ProductEditForm 단일 상단 바 [변경 취소][변경사항 저장] 가 양쪽 dirty 모두 처리.

   책임:
   - 이미지 reorder 미리보기 (imageDraftOrder)
   - dirty 판정 (imageOrderDirty = draft ≠ original)
   - 저장 후 base 갱신 (commitImageOrder)
   - 즉시 액션 (업로드/삭제) 후 base 재설정 (rebaseImageOrder)
   - 변경 취소 시 reset (resetImageOrder)

   사용처:
   - ProductImageReorderClient — reorder 액션 (↑/↓/대표) 시 setImageDraftOrder
     · 업로드/삭제/활성 토글 (즉시 server) 성공 후 rebaseImageOrder
   - ProductEditForm — imageOrderDirty 구독 + 저장/취소 시 commit/reset 호출

   ADR-004 (state mgmt 단순화) 정합: TanStack/Zustand 추가 X, React 표준 Context.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PdpDirtyContextValue = {
  /** 이미지 미리보기 순서 (↑/↓/대표 클릭 즉시 반영) */
  imageDraftOrder: string[];
  /** draft ≠ original 비교 결과 */
  imageOrderDirty: boolean;
  /** reorder 액션 호출 (server 호출 없음 · dirty 만 등록) */
  setImageDraftOrder: (ids: string[]) => void;
  /** 변경 취소 — draft ← original */
  resetImageOrder: () => void;
  /** 저장 성공 후 base 동기화 — original ← ids · draft ← ids */
  commitImageOrder: (ids: string[]) => void;
  /** 즉시 액션 (업로드/삭제) 후 base 재설정 — server 가 반환한 새 ids 기준 */
  rebaseImageOrder: (ids: string[]) => void;
};

const PdpDirtyContext = createContext<PdpDirtyContextValue | null>(null);

export function usePdpDirty(): PdpDirtyContextValue {
  const ctx = useContext(PdpDirtyContext);
  if (!ctx) {
    throw new Error('usePdpDirty must be used within <PdpDirtyProvider>');
  }
  return ctx;
}

type Props = {
  initialImageOrder: string[];
  children: ReactNode;
};

export function PdpDirtyProvider({ initialImageOrder, children }: Props) {
  const [draft, setDraft] = useState<string[]>(initialImageOrder);
  const [original, setOriginal] = useState<string[]>(initialImageOrder);

  const imageOrderDirty = useMemo(
    () => draft.join(',') !== original.join(','),
    [draft, original],
  );

  const setImageDraftOrder = useCallback((ids: string[]) => {
    setDraft(ids);
  }, []);

  const resetImageOrder = useCallback(() => {
    setDraft(original);
  }, [original]);

  const commitImageOrder = useCallback((ids: string[]) => {
    setOriginal(ids);
    setDraft(ids);
  }, []);

  const rebaseImageOrder = useCallback((ids: string[]) => {
    setOriginal(ids);
    setDraft(ids);
  }, []);

  const value = useMemo<PdpDirtyContextValue>(
    () => ({
      imageDraftOrder: draft,
      imageOrderDirty,
      setImageDraftOrder,
      resetImageOrder,
      commitImageOrder,
      rebaseImageOrder,
    }),
    [
      draft,
      imageOrderDirty,
      setImageDraftOrder,
      resetImageOrder,
      commitImageOrder,
      rebaseImageOrder,
    ],
  );

  return (
    <PdpDirtyContext.Provider value={value}>
      {children}
    </PdpDirtyContext.Provider>
  );
}
