/* ══════════════════════════════════════════
   ConfirmModal — mp-modal-* 패턴 통합 컴포넌트

   기존 SubscriptionEditor 의 skip/cancel/pause 3 모달 + 다른 mp-modal 패턴 재사용.
   호출처는 conditional render 로 표시 제어 ({open && <ConfirmModal ... />}).

   - title: 헤드라인 한 줄
   - desc: 본문 (ReactNode — <strong>, <br /> 포함 가능)
   - confirmLabel: 우측 confirm 버튼 텍스트
   - confirmVariant: 'default' (기본) | 'danger' (mp-modal-confirm--danger 적용)
   - cancelLabel: 좌측 cancel 버튼 텍스트 (default '취소')
   - onCancel: overlay 클릭 + cancel 버튼 클릭 핸들러
   - onConfirm: confirm 버튼 클릭 핸들러
   ══════════════════════════════════════════ */

'use client';

import type { ReactNode } from 'react';

interface ConfirmModalProps {
  title: string;
  desc: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'default' | 'danger';
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  title,
  desc,
  confirmLabel,
  confirmVariant = 'default',
  cancelLabel = '취소',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <div className="mp-modal-overlay" onClick={onCancel}>
      <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
        <p className="mp-modal-title">{title}</p>
        <p className="mp-modal-desc">{desc}</p>
        <div className="mp-modal-actions">
          <button
            className="mp-modal-cancel"
            type="button"
            onClick={onCancel}
            data-gtr-tap
          >
            {cancelLabel}
          </button>
          <button
            className={`mp-modal-confirm${confirmVariant === 'danger' ? ' mp-modal-confirm--danger' : ''}`}
            type="button"
            onClick={onConfirm}
            data-gtr-tap
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
