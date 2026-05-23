/* ══════════════════════════════════════════
   sections/NoticeSubForm.tsx — Section 2: 공지 배너 (S256-A 분리)

   - 라이브 미리보기 (composeNoticeText 합성 · 4 테마 색상)
   - auto_text 체크박스 + 배너 문구 input + 보조 영문 + 링크
   - 4종 테마 picker (Aa 미니 카드)
   - shipping prop (read-only) — auto_text 모드에서 composeNoticeText 합성용
   ══════════════════════════════════════════ */

import { Checkbox } from '@/components/admin/ui/checkbox';
import {
  composeNoticeText,
  NOTICE_COLOR_THEMES,
  type NoticeSettings,
  type ShippingSettings,
} from '@/lib/siteSettings';
import { SettingsCard } from '../_shared/SettingsCard';
import { FormField } from '../_shared/FormField';
import { FormInput } from '../_shared/FormInput';

interface NoticeSubFormProps {
  value: NoticeSettings;
  onChange: (patch: Partial<NoticeSettings>) => void;
  /** auto_text 합성용 read-only — Shipping 영역 값. */
  shipping: ShippingSettings;
}

export function NoticeSubForm({ value, onChange, shipping }: NoticeSubFormProps) {
  return (
    <SettingsCard
      title="공지 배너"
      subtitle="페이지 최상단에 노출되는 1줄 띠 배너"
      on={value.enabled}
      onToggle={() => onChange({ enabled: !value.enabled })}
    >
      <div className="flex flex-col gap-4">
        {/* 라이브 미리보기 */}
        <div
          className="rounded-[6px] overflow-hidden border border-border"
          style={{ opacity: value.enabled ? 1 : 0.4 }}
        >
          <div className="text-[10px] font-mono px-2.5 py-1 bg-[var(--surface-muted)] text-[var(--foreground-subtle)] border-b border-border">
            미리보기 · goodthingsroasters.com
          </div>
          <div
            className="px-4 py-2.5 text-sm text-center tracking-[-0.005em]"
            style={{
              background: NOTICE_COLOR_THEMES[value.theme_idx][0],
              color: NOTICE_COLOR_THEMES[value.theme_idx][1],
            }}
          >
            {(() => {
              const previewText = composeNoticeText(value, shipping);
              const previewSecondary = value.secondary;
              if (!previewText && !previewSecondary) {
                return (
                  <span className="opacity-50 italic">
                    (빈 공지 — 메인 사이트에 표시되지 않음)
                  </span>
                );
              }
              return (
                <>
                  {previewText}
                  {previewSecondary && (
                    <>
                      {previewText && ' · '}
                      <span className="opacity-[0.85]">{previewSecondary}</span>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <label className="flex gap-2 items-center cursor-pointer">
          <Checkbox
            checked={value.auto_text}
            onCheckedChange={(v) => onChange({ auto_text: v === true })}
          />
          <span className="text-xs font-medium">
            무료배송 임계값 자동 표시{' '}
            <span className="text-muted-foreground font-normal">(권장)</span>
          </span>
        </label>

        <div className="grid grid-cols-[1fr_200px] gap-3">
          <FormField
            label="배너 문구"
            hint={
              value.auto_text
                ? '자동 모드 ON — "무료 배송 정책" 카드의 기준 금액으로 합성됩니다'
                : '비워두면 보조 문구만 표시 · 이모지 1개와 링크 1개 권장'
            }
          >
            <FormInput
              value={
                value.auto_text
                  ? composeNoticeText(value, shipping)
                  : value.text
              }
              onChange={(e) => onChange({ text: e.target.value })}
              disabled={value.auto_text}
              placeholder="예: 5월의 새 원두 입고 — 첫 주문 10% 할인"
            />
          </FormField>
          <FormField label="링크">
            <FormInput
              value={value.link}
              onChange={(e) => onChange({ link: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="보조 문구 (영문)" hint="비워두면 표시 안 함">
          <FormInput
            value={value.secondary}
            onChange={(e) => onChange({ secondary: e.target.value })}
          />
        </FormField>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">색상 테마</span>
          <div className="flex gap-1.5">
            {NOTICE_COLOR_THEMES.map(([bg, fg], i) => {
              const sel = i === value.theme_idx;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ theme_idx: i })}
                  aria-label={`색상 테마 ${i + 1}`}
                  aria-pressed={sel}
                  className="size-7 rounded-[5px] flex items-center justify-center text-[10px] font-semibold cursor-pointer p-0"
                  style={{
                    background: bg,
                    color: fg,
                    border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                  }}
                >
                  Aa
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
