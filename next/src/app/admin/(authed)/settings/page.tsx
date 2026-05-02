'use client';

/* ══════════════════════════════════════════
   AdminSettingsPage — 시안 settings.jsx 풀 이식 (S126).
   - 카드 3개: 공지 배너 (라이브 미리보기) / 시즌 배너 / 무료 배송 정책
   - 데이터 mock. 실 저장 + DB 스키마 연결은 Group H 백엔드 단계.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

const COLOR_THEMES: ReadonlyArray<readonly [string, string]> = [
  ['#1A1A1A', '#FAF6EE'],
  ['#C96442', '#FFFFFF'],
  ['#2F7D4F', '#FFFFFF'],
  ['#FAF6EE', '#1A1A1A'],
];

export default function AdminSettingsPage() {
  const [noticeOn, setNoticeOn] = useState(true);
  const [seasonOn, setSeasonOn] = useState(true);
  const [freeShipOn, setFreeShipOn] = useState(true);
  const [themeIdx, setThemeIdx] = useState(0);

  return (
    <>
      <AdminTopbarActions>
        <button type="button" style={SM_GHOST}>변경 취소</button>
        <button type="button" style={SM_PRIMARY}>변경사항 저장</button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div
        style={{
          marginBottom: 22,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.02em',
            }}
          >
            메인 사이트 설정
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
            B2C 사이트(<span className="gtr-mono">goodthings.kr</span>)에 즉시 반영돼요. 변경사항은 자동저장되지 않아요.
          </div>
        </div>
        <Badge tone="warning">저장되지 않은 변경 2개</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 880 }}>
        {/* Section 1 — 공지 배너 */}
        <SettingsCard
          title="공지 배너"
          subtitle="페이지 최상단에 노출되는 1줄 띠 배너"
          on={noticeOn}
          onToggle={() => setNoticeOn((v) => !v)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 라이브 미리보기 */}
            <div
              style={{
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                opacity: noticeOn ? 1 : 0.4,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  padding: '4px 10px',
                  background: 'var(--surface-muted)',
                  color: 'var(--foreground-subtle)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                미리보기 · goodthings.kr
              </div>
              <div
                style={{
                  background: COLOR_THEMES[themeIdx][0],
                  color: COLOR_THEMES[themeIdx][1],
                  padding: '10px 16px',
                  fontSize: 13,
                  textAlign: 'center',
                  letterSpacing: '-0.005em',
                }}
              >
                🌱 5월의 새 원두 <strong>에티오피아 코케 G1</strong>이 입고되었습니다 · 첫 주문 10% 할인 →
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
              <FormField label="배너 문구" hint="이모지 1개와 링크 1개 권장">
                <FormInput defaultValue="🌱 5월의 새 원두 에티오피아 코케 G1이 입고되었습니다" />
              </FormField>
              <FormField label="링크">
                <FormInput defaultValue="/products/koke-g1" />
              </FormField>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>색상 테마</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {COLOR_THEMES.map(([bg, fg], i) => {
                  const sel = i === themeIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setThemeIdx(i)}
                      aria-label={`색상 테마 ${i + 1}`}
                      aria-pressed={sel}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 5,
                        background: bg,
                        color: fg,
                        border: sel ? '2px solid var(--primary)' : '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
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

        {/* Section 2 — 시즌 배너 */}
        <SettingsCard
          title="시즌 배너"
          subtitle="홈 히어로 영역의 큰 배너"
          on={seasonOn}
          onToggle={() => setSeasonOn((v) => !v)}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 240px',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="제목">
                <FormInput defaultValue="2026 봄 — 산뜻한 한 잔" />
              </FormField>
              <FormField label="부제 / 설명">
                <textarea
                  defaultValue="라이트 로스팅 세 가지 원두로 5월의 아침을 시작하세요."
                  style={{
                    width: '100%',
                    minHeight: 64,
                    resize: 'vertical',
                    padding: '10px 12px',
                    border: '1px solid var(--input)',
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                    color: 'var(--foreground)',
                    outline: 'none',
                    background: 'var(--surface)',
                  }}
                />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="CTA 텍스트">
                  <FormInput defaultValue="원두 보러가기" />
                </FormField>
                <FormField label="CTA 링크">
                  <FormInput defaultValue="/spring-2026" />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="시작일">
                  <FormInput defaultValue="2026.05.01" />
                </FormField>
                <FormField label="종료일">
                  <FormInput defaultValue="2026.05.31" />
                </FormField>
              </div>
            </div>

            <div>
              <FormField label="히어로 이미지">
                <div
                  style={{
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    aspectRatio: '4/5',
                    background:
                      'repeating-linear-gradient(135deg, #EEEDEB 0 6px, #F5F4F2 6px 12px)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      padding: '3px 7px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.9)',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    spring-hero.jpg · 1600×2000
                  </span>
                </div>
              </FormField>
              <button type="button" style={{ ...SM_SECONDARY, width: '100%', marginTop: 8 }}>
                이미지 변경
              </button>
            </div>
          </div>
        </SettingsCard>

        {/* Section 3 — 무료 배송 */}
        <SettingsCard
          title="무료 배송 정책"
          subtitle="장바구니 임계 금액 이상에서 자동 적용"
          on={freeShipOn}
          onToggle={() => setFreeShipOn((v) => !v)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="기준 금액" hint="이 금액 이상 결제 시 무료">
                <FormInput prefix="₩" defaultValue="40,000" suffix="이상" />
              </FormField>
              <FormField label="기본 배송비">
                <FormInput prefix="₩" defaultValue="3,500" />
              </FormField>
            </div>

            <FormField label="고객 페이지 안내 문구">
              <FormInput defaultValue="₩40,000 이상 무료배송 · 평일 14시 이전 주문 당일 출고" />
            </FormField>

            <div
              style={{
                padding: 12,
                borderRadius: 6,
                background: 'var(--info-soft)',
                border: '1px solid #C5DCF1',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                fontSize: 12.5,
                color: 'var(--info)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <div>
                <div style={{ fontWeight: 500, color: '#1F4F8B' }}>지난 30일 주문 분석</div>
                <div style={{ marginTop: 2, color: 'var(--info)' }}>
                  현재 임계 금액 ₩40,000 기준 평균 객단가 ₩38,200 · 무료배송 적용률 42%
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>
    </>
  );
}

/* ── 로컬 컴포넌트 ─────────────────────────────────── */

function SettingsCard({
  title,
  subtitle,
  on,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface)',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {title}
          </h3>
          <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: on ? 'var(--success)' : 'var(--foreground-muted)',
          }}
        >
          {on ? '활성' : '비활성'}
        </span>
        <Toggle on={on} onClick={onToggle} />
      </div>
      <div
        style={{
          padding: 22,
          opacity: on ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: on ? 'var(--primary)' : '#D4D4D2',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

function Badge({ tone, children }: { tone: 'warning'; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'var(--warning-soft)',
        color: 'var(--warning)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '-0.005em',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--warning)' }}
      />
      {children}
    </span>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: 'var(--foreground)',
          letterSpacing: '-0.005em',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--primary)' }}>*</span>}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>{hint}</div>
      )}
    </div>
  );
}

function FormInput({
  prefix,
  suffix,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 34,
        background: 'var(--surface)',
        border: '1px solid var(--input)',
        borderRadius: 6,
      }}
    >
      {prefix && (
        <span style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>{prefix}</span>
      )}
      <input
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--foreground)',
          padding: 0,
          height: '100%',
        }}
      />
      {suffix && (
        <span style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>{suffix}</span>
      )}
    </div>
  );
}

/* ── 시안 Button(size=sm) inline style ─────────────────────────────────── */

const SM_BASE: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  height: 28,
  gap: 5,
  borderRadius: 6,
  fontWeight: 500,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.005em',
};

const SM_SECONDARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--surface)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
};

const SM_GHOST: React.CSSProperties = {
  ...SM_BASE,
  background: 'transparent',
  color: 'var(--foreground-muted)',
  border: '1px solid transparent',
};

const SM_PRIMARY: React.CSSProperties = {
  ...SM_BASE,
  background: 'var(--primary)',
  color: '#fff',
  border: '1px solid var(--primary)',
};
