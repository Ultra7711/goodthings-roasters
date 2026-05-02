'use client';

/* ══════════════════════════════════════════
   AdminProductNewPage — 시안 product-form.jsx 풀 이식 (S126).
   - 5탭 폼 + 좌측 입력 / 우측 이미지 업로드 + 공개 상태 + 로스팅 일정
   - 데이터 mock. 실 저장 + Storage 연결은 Group D 백엔드 단계.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';

type TabId = 'basic' | 'detail' | 'option' | 'shipping' | 'seo';
type VisibilityId = 'draft' | 'active' | 'hidden';

const TABS: ReadonlyArray<readonly [TabId, string]> = [
  ['basic', '기본 정보'],
  ['detail', '상세 설명'],
  ['option', '옵션 / 재고'],
  ['shipping', '배송'],
  ['seo', 'SEO'],
];

const VISIBILITY: ReadonlyArray<{ id: VisibilityId; label: string; desc: string }> = [
  { id: 'draft', label: '초안', desc: '아직 등록 중' },
  { id: 'active', label: '판매중', desc: '고객에게 노출' },
  { id: 'hidden', label: '비공개', desc: '링크로만 접근' },
];

const FLAVOR_TAGS = ['자스민', '베르가못', '복숭아', '깔끔한 산미'];

const CARD_TITLE: React.CSSProperties = {
  margin: '0 0 16px',
  fontFamily: 'var(--font-serif)',
  fontSize: 15,
  fontWeight: 500,
};

const CARD_BASE: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
};

export default function AdminProductNewPage() {
  const [tab, setTab] = useState<TabId>('basic');
  const [visibility, setVisibility] = useState<VisibilityId>('active');

  return (
    <>
      <AdminTopbarActions>
        <button type="button" style={SM_SECONDARY}>미리보기</button>
        <button type="button" style={SM_GHOST}>임시저장</button>
        <button type="button" style={SM_PRIMARY}>등록하기</button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-serif)',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '-0.02em',
          }}
        >
          신규 상품 등록
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--foreground-muted)' }}>
          판매할 원두·가공품 정보를 입력해주세요. <span style={{ color: 'var(--primary)' }}>*</span> 표시는 필수 항목이에요.
        </div>
      </div>

      {/* 탭 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border)',
          marginBottom: 22,
        }}
      >
        {TABS.map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                position: 'relative',
              }}
            >
              {label}
              {active && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--primary)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 본문 grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* 좌측: 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 기본 정보 카드 */}
          <div style={{ ...CARD_BASE, padding: 22 }}>
            <h3 style={CARD_TITLE}>기본 정보</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormField label="상품명" required hint="고객에게 노출되는 이름이에요. (최대 60자)">
                <FormInput defaultValue="에티오피아 예가체프 코케 G1" />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="카테고리" required>
                  <FormSelect value="원두 · 싱글 오리진" />
                </FormField>
                <FormField label="브루잉 스타일">
                  <FormSelect value="필터 / 핸드드립" />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="판매가" required>
                  <FormInput prefix="₩" defaultValue="18,000" suffix="KRW" />
                </FormField>
                <FormField label="할인가" hint="비워두면 정가 판매">
                  <FormInput prefix="₩" placeholder="0" />
                </FormField>
                <FormField label="재고" required>
                  <FormInput defaultValue="142" suffix="개" />
                </FormField>
              </div>

              <FormField
                label="원산지 / 농장"
                hint="고객 페이지의 트레이서빌리티에 표시돼요."
              >
                <FormInput defaultValue="에티오피아 · 예가체프 코케 워시드 스테이션" />
              </FormField>
            </div>
          </div>

          {/* 커핑 노트 & 가공 카드 */}
          <div style={{ ...CARD_BASE, padding: 22 }}>
            <h3 style={CARD_TITLE}>커핑 노트 & 가공</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FormField label="플레이버 태그" hint="최대 5개. Enter로 추가">
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    padding: 8,
                    border: '1px solid var(--input)',
                    borderRadius: 6,
                    minHeight: 40,
                  }}
                >
                  {FLAVOR_TAGS.map((t) => (
                    <span
                      key={t}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: 'var(--primary-soft)',
                        color: 'var(--primary-soft-fg)',
                        fontSize: 12,
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {t}
                      <span style={{ cursor: 'pointer', opacity: 0.6 }} aria-hidden>
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    style={{
                      flex: 1,
                      minWidth: 80,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      padding: '4px 6px',
                    }}
                    placeholder="태그 추가…"
                  />
                </div>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="가공 방식">
                  <FormSelect value="워시드 (Washed)" />
                </FormField>
                <FormField label="로스팅 포인트">
                  <FormSelect value="라이트 미디엄" />
                </FormField>
              </div>

              <FormField
                label="상품 설명"
                hint="고객 페이지 상단에 노출되는 짧은 설명이에요."
              >
                <textarea
                  defaultValue="해발 1,950m 코케 마을의 워시드 G1. 자스민과 베르가못의 산뜻한 향, 잘 익은 백도의 단맛이 길게 이어집니다. 핸드드립과 에어로프레스에 특히 잘 어울려요."
                  style={{
                    width: '100%',
                    minHeight: 96,
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
            </div>
          </div>
        </div>

        {/* 우측: 이미지 + 공개 + 로스팅 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            position: 'sticky',
            top: 0,
          }}
        >
          {/* 상품 이미지 */}
          <div style={{ ...CARD_BASE, padding: 20 }}>
            <h3 style={CARD_TITLE}>상품 이미지</h3>

            {/* primary upload */}
            <div
              style={{
                border: '1.5px dashed var(--border-strong)',
                borderRadius: 8,
                padding: '32px 16px',
                textAlign: 'center',
                background: 'var(--background)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  margin: '0 auto 10px',
                  borderRadius: 999,
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <UploadIcon />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                이미지를 드래그하거나{' '}
                <span style={{ color: 'var(--primary)' }}>찾아보기</span>
              </div>
              <div
                style={{ marginTop: 4, fontSize: 11.5, color: 'var(--foreground-muted)' }}
              >
                PNG, JPG · 최대 5MB · 권장 1200×1200
              </div>
            </div>

            {/* 업로드된 thumbs */}
            <div
              style={{
                marginTop: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
              }}
            >
              {[
                { primary: true, label: '메인' },
                { primary: false, label: '서브 1' },
                { primary: false, label: '서브 2' },
              ].map((img, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: img.primary
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border)',
                    background:
                      'repeating-linear-gradient(135deg, #EEEDEB 0 6px, #F5F4F2 6px 12px)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'flex-start',
                    padding: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.85)',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    {img.label}
                  </span>
                  {img.primary && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: 'var(--primary)',
                        color: '#fff',
                      }}
                    >
                      대표
                    </span>
                  )}
                </div>
              ))}
              <button
                type="button"
                aria-label="이미지 추가"
                style={{
                  aspectRatio: '1',
                  borderRadius: 6,
                  border: '1px dashed var(--border-strong)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--foreground-subtle)',
                  cursor: 'pointer',
                  fontSize: 20,
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* 공개 상태 */}
          <div style={{ ...CARD_BASE, padding: 20 }}>
            <h3 style={CARD_TITLE}>공개 상태</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VISIBILITY.map(({ id, label, desc }) => {
                const sel = visibility === id;
                return (
                  <label
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 10,
                      border: '1px solid ' + (sel ? 'var(--primary)' : 'var(--border)'),
                      borderRadius: 6,
                      background: sel ? 'var(--primary-soft)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={id}
                      checked={sel}
                      onChange={() => setVisibility(id)}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: 0,
                        height: 0,
                        pointerEvents: 'none',
                      }}
                    />
                    <span
                      aria-hidden
                      style={{
                        marginTop: 2,
                        width: 14,
                        height: 14,
                        borderRadius: 999,
                        border:
                          '1.5px solid ' +
                          (sel ? 'var(--primary)' : 'var(--border-strong)'),
                        background: 'var(--surface)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {sel && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: 'var(--primary)',
                          }}
                        />
                      )}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>
                      <span style={{ fontWeight: 500, display: 'block' }}>{label}</span>
                      <span
                        style={{
                          color: 'var(--foreground-muted)',
                          fontSize: 11.5,
                          marginTop: 2,
                          display: 'block',
                        }}
                      >
                        {desc}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 로스팅 일정 */}
          <div style={{ ...CARD_BASE, padding: 20 }}>
            <h3 style={CARD_TITLE}>로스팅 일정</h3>
            <FormField label="다음 로스팅" hint="수령까지 약 2-3일 소요">
              <FormInput defaultValue="2026.05.05 (월)" />
            </FormField>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 폼 primitives ─────────────────────────────────── */

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

/* mock select — 시안과 동일하게 select like 표시 (실 select 동작은 후속) */
function FormSelect({ value }: { value: string }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 34,
        border: '1px solid var(--input)',
        borderRadius: 6,
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1 }}>{value}</span>
      <span style={{ color: 'var(--foreground-muted)' }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  );
}

/* ── 인라인 SVG ─────────────────────────────────── */

const UploadIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

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
