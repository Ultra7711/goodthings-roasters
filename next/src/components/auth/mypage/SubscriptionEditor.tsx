'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { extractKrName } from '@/lib/utils';
import type { SubscriptionCycle } from '@/types/subscription';
import { SUBSCRIPTION_CYCLES } from '@/types/subscription';
import { InfoCircleIcon } from '@/components/ui/Icons';
import {
  useSubscriptionsQuery,
  useUpdateSubscriptionCycle,
  useCancelSubscription,
  useSkipSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from '@/hooks/useSubscriptions';
import {
  useMyPageSubEditId,
  useMyPageSubCycleEdit,
  useMyPageCycleDropdownOpen,
  useMyPageSkipConfirmSubId,
  useMyPageCancelConfirmSubId,
  useMyPagePauseConfirmSubId,
  setSubEditId,
  setSubCycleEdit,
  setCycleDropdownOpen,
  toggleCycleDropdownOpen,
  setSkipConfirmSubId,
  setCancelConfirmSubId,
  setPauseConfirmSubId,
} from '@/lib/myPageUiStore';

const CYCLE_DAYS: Record<SubscriptionCycle, number> = {
  '2주': 14,
  '4주': 28,
  '6주': 42,
  '8주': 56,
};

export default function SubscriptionEditor() {
  const { show: toast } = useToast();
  const { subscriptions, isLoading } = useSubscriptionsQuery();

  const subEditId = useMyPageSubEditId();
  const subCycleEdit = useMyPageSubCycleEdit();
  const isCycleDropdownOpen = useMyPageCycleDropdownOpen();
  const skipConfirmSubId = useMyPageSkipConfirmSubId();
  const cancelConfirmSubId = useMyPageCancelConfirmSubId();
  const pauseConfirmSubId = useMyPagePauseConfirmSubId();

  const updateCycleMutation = useUpdateSubscriptionCycle();
  const cancelMutation = useCancelSubscription();
  const skipMutation = useSkipSubscription();
  const pauseMutation = usePauseSubscription();
  const resumeMutation = useResumeSubscription();

  const cycleDropdownRef = useRef<HTMLDivElement>(null);

  /* sub 모달 오픈 시 스크롤 잠금 */
  useEffect(() => {
    const anyOpen = !!skipConfirmSubId || !!cancelConfirmSubId || !!pauseConfirmSubId;
    if (!anyOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [skipConfirmSubId, cancelConfirmSubId, pauseConfirmSubId]);

  /* BUG-125: capture-phase 외부 클릭 닫기 */
  useEffect(() => {
    if (!isCycleDropdownOpen) return;
    const onCapture = (e: MouseEvent) => {
      if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        setCycleDropdownOpen(false);
      }
    };
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
  }, [isCycleDropdownOpen]);

  const openSubAccordion = useCallback((sub: { id: string; cycle: SubscriptionCycle }) => {
    setSubEditId(sub.id);
    setSubCycleEdit(sub.cycle);
    setCycleDropdownOpen(false);
  }, []);

  /* 배송 주기 변경 시 다음 배송일 미리보기 — 직전 배송일 = nextDate - oldCycle 로
     역산하여 newCycle 적용. 서버 정책과 동일 가정 (단순 cycleDays 가산). */
  const previewNextDate = useCallback(
    (nextDate: string, oldCycle: SubscriptionCycle, newCycle: SubscriptionCycle): string => {
      if (oldCycle === newCycle) return nextDate;
      const [y, m, d] = nextDate.split('.').map(Number);
      const base = new Date(y, m - 1, d);
      base.setDate(base.getDate() - CYCLE_DAYS[oldCycle] + CYCLE_DAYS[newCycle]);
      return `${base.getFullYear()}.${String(base.getMonth() + 1).padStart(2, '0')}.${String(base.getDate()).padStart(2, '0')}`;
    },
    [],
  );

  const saveSubCycle = useCallback((subId: string) => {
    if (!subCycleEdit) return;
    /* paused 상태에서 cycle 변경 시 "재개 후 적용" 안내 — PATCH 전 캡처 */
    const prev = subscriptions.find((s) => s.id === subId);
    const wasPaused = prev?.status === 'paused';
    updateCycleMutation.mutate(
      { id: subId, cycle: subCycleEdit },
      {
        onSuccess: () => {
          setSubEditId(null);
          toast(
            wasPaused
              ? '배송 주기가 변경되었습니다. 재개 시 새 주기로 배송됩니다.'
              : '배송 주기가 변경되었습니다.',
          );
        },
      },
    );
  }, [subCycleEdit, subscriptions, toast, updateCycleMutation]);

  const cancelSub = useCallback((subId: string) => {
    cancelMutation.mutate(subId, {
      onSuccess: () => {
        setSubEditId(null);
        setCancelConfirmSubId(null);
        toast('구독이 해지되었습니다.');
      },
    });
  }, [cancelMutation, toast]);

  const skipDelivery = useCallback((subId: string) => {
    skipMutation.mutate(subId, {
      onSuccess: () => {
        setSkipConfirmSubId(null);
        toast('다음 배송일이 변경되었습니다.');
      },
    });
  }, [skipMutation, toast]);

  const pauseSub = useCallback((subId: string) => {
    pauseMutation.mutate(subId, {
      onSuccess: () => {
        setPauseConfirmSubId(null);
        toast('정기배송이 일시정지되었습니다.');
      },
    });
  }, [pauseMutation, toast]);

  const resumeSub = useCallback((subId: string) => {
    resumeMutation.mutate(subId, {
      onSuccess: () => {
        toast('정기배송이 재개되었습니다.');
      },
    });
  }, [resumeMutation, toast]);

  return (
    <>
      <div className="mp-section mp-section--no-border">
        <h2 className="mp-section-title">정기배송 관리</h2>
        <div className="mp-section-body">
          <div className="mp-sub-list">
            {isLoading ? (
              <div className="mp-empty-state">불러오는 중…</div>
            ) : subscriptions.length === 0 ? (
              <div className="mp-empty-state">정기배송 내역이 없습니다.</div>
            ) : (
              subscriptions.map((sub) => (
                <div className="mp-sub-item" key={sub.id}>
                  <div
                    className="mp-sub-item-top"
                    role="button"
                    tabIndex={0}
                    aria-label={subEditId === sub.id ? '닫기' : '편집'}
                    onClick={() => {
                      if (subEditId === sub.id) {
                        setSubEditId(null);
                        setSubCycleEdit(null);
                      } else {
                        openSubAccordion(sub);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (subEditId === sub.id) {
                          setSubEditId(null);
                          setSubCycleEdit(null);
                        } else {
                          openSubAccordion(sub);
                        }
                      }
                    }}
                  >
                    <div className="mp-sub-item-info">
                      <span className="mp-sub-item-name">
                        {extractKrName(sub.name)}
                        <span className="mp-sub-item-vol"> · {sub.volume}</span>
                        <span className="mp-sub-item-vol"> · 정기배송 {sub.cycle}</span>
                      </span>
                      {sub.status === 'paused' ? (
                        <span className="mp-sub-item-status mp-sub-item-status--paused">
                          <InfoCircleIcon size={18} />
                          일시정지 중
                        </span>
                      ) : (
                        <span className="mp-sub-item-status">다음 배송 {sub.nextDate}</span>
                      )}
                    </div>
                    <div className="mp-sub-controls">
                      {subEditId === sub.id && (
                        <button
                          className="mp-cancel-link mp-sub-cancel-inline"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelConfirmSubId(sub.id);
                          }}
                          data-gtr-tap
                        >
                          구독 해지
                        </button>
                      )}
                      <span
                        className={`mp-icon-btn mp-sub-edit-btn${subEditId === sub.id ? ' open' : ''}`}
                        aria-hidden="true"
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path className="mp-sub-toggle-chevron" d="M9 6l6 6-6 6" />
                          <path className="mp-sub-toggle-close" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div
                    className={`mp-form-reveal mp-form-reveal--sub${subEditId === sub.id ? ' open' : ''}`}
                  >
                    <div className="mp-form-reveal-inner">
                      <div
                        className="chp-field has-value mp-cycle-dropdown-wrap"
                        ref={subEditId === sub.id ? cycleDropdownRef : undefined}
                      >
                        <button
                          className="chp-input mp-cycle-trigger"
                          type="button"
                          onClick={toggleCycleDropdownOpen}
                        >
                          <span>
                            {subCycleEdit ? `${subCycleEdit}마다 배송` : `${sub.cycle}마다 배송`}
                          </span>
                          <svg
                            className={`mp-cycle-chevron${isCycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`}
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6,10l6,6,6-6" />
                          </svg>
                        </button>
                        <label className="chp-floating-label">배송 주기</label>
                        <div
                          className={`pd-dropdown-panel${isCycleDropdownOpen && subEditId === sub.id ? ' open' : ''}`}
                        >
                          <div className="pd-dropdown-hint">배송 주기 선택</div>
                          {SUBSCRIPTION_CYCLES.map((c) => (
                            <div
                              key={c}
                              className={`pd-dropdown-option${c === subCycleEdit ? ' active' : ''}`}
                              onClick={() => {
                                setSubCycleEdit(c);
                                setCycleDropdownOpen(false);
                              }}
                            >
                              {c}마다 배송
                            </div>
                          ))}
                        </div>
                      </div>
                      {(() => {
                        const hasCycleChange =
                          subEditId === sub.id &&
                          subCycleEdit !== null &&
                          subCycleEdit !== sub.cycle;
                        return (
                          <div className="mp-info-row" style={{ borderBottom: 'none' }}>
                            <span className="mp-info-label">
                              다음 배송일
                              {hasCycleChange && (
                                <span className="mp-sub-cycle-change">
                                  <span className="mp-sub-cycle-divider">|</span>
                                  {sub.cycle} →{' '}
                                  <span className="mp-sub-accent">{subCycleEdit}</span>
                                </span>
                              )}
                            </span>
                            <span className="mp-sub-next-right">
                              <span
                                className={`mp-info-value${hasCycleChange ? ' mp-sub-accent' : ''}`}
                              >
                                {hasCycleChange
                                  ? previewNextDate(sub.nextDate, sub.cycle, subCycleEdit)
                                  : sub.nextDate}
                              </span>
                              {hasCycleChange && (
                                <button
                                  className="mp-sub-apply-link"
                                  type="button"
                                  onClick={() => saveSubCycle(sub.id)}
                                  data-gtr-tap
                                >
                                  변경 적용
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                      {sub.status === 'paused' && (
                        <div className="mp-sub-paused-notice">
                          <InfoCircleIcon size={18} />
                          {subEditId === sub.id &&
                          subCycleEdit !== null &&
                          subCycleEdit !== sub.cycle
                            ? '배송이 일시정지 중입니다. 재개 후 변경된 주기가 적용됩니다.'
                            : '배송이 일시정지 중입니다.'}
                        </div>
                      )}
                      <div className="mp-form-reveal-actions mp-form-reveal-actions--sub">
                        <button
                          className="mp-cancel-btn"
                          type="button"
                          disabled={sub.status === 'paused'}
                          onClick={() => setSkipConfirmSubId(sub.id)}
                          data-gtr-tap
                        >
                          배송 건너뛰기
                        </button>
                        {sub.status === 'paused' ? (
                          <button
                            className="mp-save-btn"
                            type="button"
                            onClick={() => resumeSub(sub.id)}
                            data-gtr-tap
                          >
                            배송 재개하기
                          </button>
                        ) : (
                          <button
                            className="mp-cancel-btn"
                            type="button"
                            onClick={() => setPauseConfirmSubId(sub.id)}
                            data-gtr-tap
                          >
                            배송 일시정지
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 배송 건너뛰기 확인 모달 ── */}
      {skipConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === skipConfirmSubId);
        if (!sub) return null;
        const [ny, nm, nd] = sub.nextDate.split('.').map(Number);
        const nextD = new Date(ny, nm - 1, nd);
        nextD.setDate(nextD.getDate() + (CYCLE_DAYS[sub.cycle] ?? 28));
        const nextDate = `${nextD.getFullYear()}.${String(nextD.getMonth() + 1).padStart(2, '0')}.${String(nextD.getDate()).padStart(2, '0')}`;
        return (
          <div className="mp-modal-overlay" onClick={() => setSkipConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">배송을 건너뛸까요?</p>
              <p className="mp-modal-desc">
                이번 배송을 건너뛰면 다음 배송일이<br />
                <strong>{nextDate}</strong>으로 변경됩니다.
              </p>
              <div className="mp-modal-actions">
                <button
                  className="mp-modal-cancel"
                  type="button"
                  onClick={() => setSkipConfirmSubId(null)}
                  data-gtr-tap
                >
                  취소
                </button>
                <button
                  className="mp-modal-confirm"
                  type="button"
                  onClick={() => skipDelivery(skipConfirmSubId)}
                  data-gtr-tap
                >
                  건너뛰기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 구독 해지 확인 모달 ── */}
      {cancelConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === cancelConfirmSubId);
        if (!sub) return null;
        return (
          <div className="mp-modal-overlay" onClick={() => setCancelConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">구독을 해지할까요?</p>
              <p className="mp-modal-desc">
                {extractKrName(sub.name)} 정기배송이 해지됩니다.<br />
                해지 후에는 복구되지 않습니다.
              </p>
              <div className="mp-modal-actions">
                <button
                  className="mp-modal-cancel"
                  type="button"
                  onClick={() => setCancelConfirmSubId(null)}
                  data-gtr-tap
                >
                  취소
                </button>
                <button
                  className="mp-modal-confirm mp-modal-confirm--danger"
                  type="button"
                  onClick={() => cancelSub(cancelConfirmSubId)}
                  data-gtr-tap
                >
                  해지
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 일시정지 확인 모달 ── */}
      {pauseConfirmSubId && (() => {
        const sub = subscriptions.find((s) => s.id === pauseConfirmSubId);
        if (!sub) return null;
        return (
          <div className="mp-modal-overlay" onClick={() => setPauseConfirmSubId(null)}>
            <div className="mp-modal mp-modal--calm" onClick={(e) => e.stopPropagation()}>
              <p className="mp-modal-title">배송을 일시정지할까요?</p>
              <p className="mp-modal-desc">
                언제든지 재개할 수 있습니다.<br />
                일시정지 중에는 배송이 이루어지지 않습니다.
              </p>
              <div className="mp-modal-actions">
                <button
                  className="mp-modal-cancel"
                  type="button"
                  onClick={() => setPauseConfirmSubId(null)}
                  data-gtr-tap
                >
                  취소
                </button>
                <button
                  className="mp-modal-confirm"
                  type="button"
                  onClick={() => pauseSub(pauseConfirmSubId)}
                  data-gtr-tap
                >
                  일시정지
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
