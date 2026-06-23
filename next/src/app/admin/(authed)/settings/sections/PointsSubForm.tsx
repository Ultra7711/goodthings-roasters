/* ══════════════════════════════════════════
   sections/PointsSubForm.tsx — Section 5: 적립금(포인트) 정책 (S327 · Phase 4)

   - 마스터 토글(enabled) = 시스템 전체 on/off (OFF 시 사이트 표시·적립·사용 0)
   - 적립(earn): 적립률 % · 구매확정 자동확정일
   - 행동 적립(triggers): 가입·리뷰·생일 (라이브 후 실효 · DEC-P4)
   - 사용(redeem): 최소 사용액 · 최대 사용 비율 %
   - 만료(expiry): 유효기간 개월 (DEC-P3 · 켜면 FIFO 소멸 + 사전 고지)

   적립 시점 = 구매확정(배송완료) 후 (DEC-P1). 구매자가 구매확정을 누르거나,
   발송 후 auto_confirm_days 경과 시 자동확정 → 적립.
   ══════════════════════════════════════════ */

import { Switch } from '@/components/admin/ui/switch';
import type { PointsSettings } from '@/lib/siteSettings';
import { SettingsCard } from '../_shared/SettingsCard';
import { FormField } from '../_shared/FormField';
import { FormInput } from '../_shared/FormInput';
import { formatNumber, parseNumber } from '../_shared/helpers';

interface PointsSubFormProps {
  value: PointsSettings;
  onChange: (patch: Partial<PointsSettings>) => void;
}

/* 적립률·사용비율: DB 0~1 저장 ↔ UI % 표시 (소수 1자리 허용). */
function rateToPercent(r: number): string {
  return String(Math.round(r * 1000) / 10);
}
function percentToRate(s: string): number {
  const n = Number.parseFloat(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, Math.round(n * 10) / 1000));
}

const TRIGGER_LABELS: Record<keyof PointsSettings['earn']['triggers'], string> = {
  signup: '회원가입',
  review: '리뷰 작성',
  birthday: '생일',
};

export function PointsSubForm({ value, onChange }: PointsSubFormProps) {
  const { earn, redeem, expiry } = value;

  const patchEarn = (p: Partial<PointsSettings['earn']>) =>
    onChange({ earn: { ...earn, ...p } });
  const patchRedeem = (p: Partial<PointsSettings['redeem']>) =>
    onChange({ redeem: { ...redeem, ...p } });
  const patchExpiry = (p: Partial<PointsSettings['expiry']>) =>
    onChange({ expiry: { ...expiry, ...p } });
  const patchTrigger = (
    key: keyof PointsSettings['earn']['triggers'],
    p: Partial<PointsSettings['earn']['triggers'][typeof key]>,
  ) =>
    patchEarn({
      triggers: { ...earn.triggers, [key]: { ...earn.triggers[key], ...p } },
    });

  return (
    <SettingsCard
      title="적립금(포인트) 정책"
      subtitle="결제·행동 적립 · 사용 한도 · 만료 (마스터 OFF 시 사이트 전체에서 숨김)"
      on={value.enabled}
      onToggle={() => onChange({ enabled: !value.enabled })}
    >
      <div className="flex flex-col gap-5">
        {/* ── 결제 적립 ── */}
        <SubSection
          title="결제 적립"
          on={earn.enabled}
          onToggle={() => patchEarn({ enabled: !earn.enabled })}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="적립률" hint="일반 품목 · 상품 소계 기준">
                <FormInput
                  suffix="%"
                  inputMode="decimal"
                  value={rateToPercent(earn.rate)}
                  onChange={(e) => patchEarn({ rate: percentToRate(e.target.value) })}
                />
              </FormField>
              <FormField
                label="구매확정 자동확정"
                hint="발송 후 N일 경과 시 자동 적립 (청약철회 7일 이후 권장)"
              >
                <FormInput
                  suffix="일 후"
                  inputMode="numeric"
                  value={formatNumber(earn.auto_confirm_days)}
                  onChange={(e) =>
                    patchEarn({
                      auto_confirm_days: Math.min(60, Math.max(1, parseNumber(e.target.value))),
                    })
                  }
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-[var(--foreground)]">
                정기배송 기간별 적립률{' '}
                <span className="text-muted-foreground font-normal">
                  (정기 품목은 일반율 대신 이 비율로 적립)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['2주', '4주', '6주', '8주'] as const).map((p) => (
                  <FormField key={p} label={p}>
                    <FormInput
                      suffix="%"
                      inputMode="decimal"
                      value={rateToPercent(earn.subscription_rates[p])}
                      onChange={(e) =>
                        patchEarn({
                          subscription_rates: {
                            ...earn.subscription_rates,
                            [p]: percentToRate(e.target.value),
                          },
                        })
                      }
                    />
                  </FormField>
                ))}
              </div>
            </div>
          </div>
        </SubSection>

        {/* ── 행동 적립 ── */}
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-medium text-[var(--foreground)]">
            행동 적립{' '}
            <span className="text-muted-foreground font-normal">
              (가입·리뷰·생일 — 라이브 후 실효)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {(Object.keys(TRIGGER_LABELS) as Array<keyof typeof TRIGGER_LABELS>).map(
              (key) => {
                const t = earn.triggers[key];
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2 rounded-[6px] border border-border bg-[var(--surface)]"
                  >
                    <label className="inline-flex items-center gap-2 cursor-pointer min-w-[120px]">
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => patchTrigger(key, { enabled: v === true })}
                        aria-label={`${TRIGGER_LABELS[key]} 적립 ${t.enabled ? '비활성' : '활성'}`}
                        className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
                      />
                      <span className="text-xs font-medium">{TRIGGER_LABELS[key]}</span>
                    </label>
                    <div className="flex-1">
                      <FormInput
                        suffix="P"
                        inputMode="numeric"
                        disabled={!t.enabled}
                        value={formatNumber(t.amount)}
                        onChange={(e) => patchTrigger(key, { amount: parseNumber(e.target.value) })}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* ── 사용 ── */}
        <SubSection
          title="포인트 사용"
          on={redeem.enabled}
          onToggle={() => patchRedeem({ enabled: !redeem.enabled })}
        >
          <div className="grid grid-cols-2 gap-3">
            <FormField label="최소 사용액" hint="이 금액 이상부터 사용 가능">
              <FormInput
                suffix="P 이상"
                inputMode="numeric"
                value={formatNumber(redeem.min)}
                onChange={(e) => patchRedeem({ min: parseNumber(e.target.value) })}
              />
            </FormField>
            <FormField label="최대 사용 비율" hint="결제액 대비 (100% = 전액)">
              <FormInput
                suffix="%"
                inputMode="numeric"
                value={rateToPercent(redeem.max_ratio)}
                onChange={(e) => patchRedeem({ max_ratio: percentToRate(e.target.value) })}
              />
            </FormField>
          </div>
        </SubSection>

        {/* ── 만료 ── */}
        <SubSection
          title="포인트 만료"
          on={expiry.enabled}
          onToggle={() => patchExpiry({ enabled: !expiry.enabled })}
        >
          <FormField
            label="유효기간"
            hint="적립일로부터. 켜면 FIFO 소멸 + 소멸 전 사전 고지 (전자상거래법)"
          >
            <FormInput
              suffix="개월"
              inputMode="numeric"
              value={formatNumber(expiry.months)}
              onChange={(e) =>
                patchExpiry({ months: Math.min(120, Math.max(1, parseNumber(e.target.value))) })
              }
            />
          </FormField>
        </SubSection>

        {/* 안내 */}
        <div className="p-3 rounded-[6px] bg-[var(--info-soft)] border border-[var(--info-border)] flex gap-3 items-start text-xs text-[var(--info)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-[1px]"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div>
            <div className="font-medium text-[#1F4F8B]">적립 시점 = 구매확정 후</div>
            <div className="mt-0.5 text-[var(--info)]">
              구매자가 구매확정을 누르거나, 발송 후 {earn.auto_confirm_days}일이 지나면 자동확정되어
              적립됩니다. 구매확정 전 취소·반품은 미적립 → 환불 시 적립 회수가 거의 없습니다.
            </div>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

/* ── 로컬 서브 섹션 (인라인 토글 + 본문) ─────────────────────────── */

function SubSection({
  title,
  on,
  onToggle,
  children,
}: {
  title: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="inline-flex items-center gap-2 cursor-pointer w-fit">
        <Switch
          checked={on}
          onCheckedChange={() => onToggle()}
          aria-label={on ? `${title} 비활성으로 전환` : `${title} 활성으로 전환`}
          className="data-[state=unchecked]:bg-[var(--switch-off-bg)]"
        />
        <span className="text-xs font-medium text-[var(--foreground)]">{title}</span>
        <span className="text-xs text-muted-foreground">{on ? '활성' : '비활성'}</span>
      </label>
      <div className="transition-opacity duration-150" style={{ opacity: on ? 1 : 0.5 }}>
        {children}
      </div>
    </div>
  );
}
