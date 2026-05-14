'use client';

/* ══════════════════════════════════════════
   AdminProductNewPage — 시안 product-form.jsx 풀 이식 (S126).
   - 5탭 폼 + 좌측 입력 / 우측 이미지 업로드 + 공개 상태 + 로스팅 일정
   - 데이터 mock. 실 저장 + Storage 연결은 Group D 백엔드 단계.
   ══════════════════════════════════════════ */

import { useState } from 'react';
import { AdminTopbarActions } from '@/components/admin/AdminTopbarActions';
import { Button } from '@/components/admin/ui/button';
import { cn } from '@/lib/utils';

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

const CARD_CLASS =
  'bg-[var(--surface)] border border-border rounded-[var(--radius)]';

const CARD_TITLE_CLASS = 'm-0 mb-4 text-base font-medium';

export default function AdminProductNewPage() {
  const [tab, setTab] = useState<TabId>('basic');
  const [visibility, setVisibility] = useState<VisibilityId>('active');

  return (
    <>
      <AdminTopbarActions>
        <Button variant="outline" size="sm" className="!h-7">
          미리보기
        </Button>
        <Button variant="ghost" size="sm" className="!h-7">
          임시저장
        </Button>
        <Button size="sm" className="!h-7">
          등록하기
        </Button>
      </AdminTopbarActions>

      {/* 헤더 */}
      <div className="mb-4">
        <h2 className="m-0 text-2xl font-medium tracking-tight">신규 상품 등록</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          판매할 원두·가공품 정보를 입력해주세요.{' '}
          <span className="text-[var(--primary)]">*</span> 표시는 필수 항목이에요.
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border mb-5">
        {TABS.map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'px-3 py-2 bg-transparent border-none cursor-pointer text-sm relative',
                active
                  ? 'font-medium text-foreground'
                  : 'font-normal text-muted-foreground',
              )}
            >
              {label}
              {active && (
                <div
                  className="absolute left-0 right-0 h-0.5 bg-[var(--primary)]"
                  style={{ bottom: -1 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 본문 grid */}
      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: '1fr 360px' }}
      >
        {/* 좌측: 폼 */}
        <div className="flex flex-col gap-3">
          {/* 기본 정보 카드 */}
          <div className={cn(CARD_CLASS, 'p-5')}>
            <h3 className={CARD_TITLE_CLASS}>기본 정보</h3>
            <div className="flex flex-col gap-4">
              <FormField label="상품명" required hint="고객에게 노출되는 이름이에요. (최대 60자)">
                <FormInput defaultValue="에티오피아 예가체프 코케 G1" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="카테고리" required>
                  <FormSelect value="원두 · 싱글 오리진" />
                </FormField>
                <FormField label="브루잉 스타일">
                  <FormSelect value="필터 / 핸드드립" />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField label="판매가" required>
                  <FormInput defaultValue="18,000" suffix="원" />
                </FormField>
                <FormField label="할인가" hint="비워두면 정가 판매">
                  <FormInput placeholder="0" suffix="원" />
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
          <div className={cn(CARD_CLASS, 'p-5')}>
            <h3 className={CARD_TITLE_CLASS}>커핑 노트 & 가공</h3>
            <div className="flex flex-col gap-4">
              <FormField label="플레이버 태그" hint="최대 5개. Enter로 추가">
                <div className="flex flex-wrap gap-1.5 p-2 border border-[var(--input)] rounded-md min-h-10">
                  {FLAVOR_TAGS.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-[var(--primary-soft)] text-[var(--primary-soft-fg)] text-xs font-medium"
                    >
                      {t}
                      <span className="cursor-pointer opacity-60" aria-hidden>
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-20 border-none outline-none bg-transparent text-sm px-1.5 py-1"
                    placeholder="태그 추가…"
                  />
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
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
                  className="w-full min-h-24 resize-y px-3 py-2.5 border border-[var(--input)] rounded-md text-sm leading-[1.6] text-[var(--foreground)] outline-none bg-[var(--surface)] shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  style={{ fontFamily: 'inherit' }}
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* 우측: 이미지 + 공개 + 로스팅 */}
        <div className="flex flex-col gap-3 sticky top-0">
          {/* 상품 이미지 */}
          <div className={cn(CARD_CLASS, 'p-5')}>
            <h3 className={CARD_TITLE_CLASS}>상품 이미지</h3>

            {/* primary upload */}
            <div
              className="rounded-lg px-4 py-8 text-center cursor-pointer bg-[var(--background)]"
              style={{ border: '1.5px dashed var(--border-strong)' }}
            >
              <div
                className="mx-auto mb-2.5 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-[var(--foreground-muted)]"
                style={{ width: 40, height: 40 }}
              >
                <UploadIcon />
              </div>
              <div className="text-sm font-medium">
                이미지를 드래그하거나{' '}
                <span className="text-[var(--primary)]">찾아보기</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                PNG, JPG · 최대 5MB · 권장 1200×1200
              </div>
            </div>

            {/* 업로드된 thumbs */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { primary: true, label: '메인' },
                { primary: false, label: '서브 1' },
                { primary: false, label: '서브 2' },
              ].map((img, i) => (
                <div
                  key={i}
                  className={cn(
                    'relative rounded-md overflow-hidden flex items-end p-1.5',
                    img.primary
                      ? 'border-2 border-[var(--primary)]'
                      : 'border border-border',
                  )}
                  style={{
                    aspectRatio: '1',
                    background:
                      'repeating-linear-gradient(135deg, #EEEDEB 0 6px, #F5F4F2 6px 12px)',
                  }}
                >
                  <span
                    className="rounded-sm bg-white/85 text-[var(--foreground-muted)]"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 9,
                      padding: '2px 6px',
                    }}
                  >
                    {img.label}
                  </span>
                  {img.primary && (
                    <span
                      className="absolute rounded-sm bg-[var(--primary)] !text-white font-semibold"
                      style={{
                        top: 6,
                        right: 6,
                        fontSize: 9,
                        padding: '2px 6px',
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
                className="rounded-md bg-transparent flex items-center justify-center text-[var(--foreground-subtle)] cursor-pointer text-xl"
                style={{
                  aspectRatio: '1',
                  border: '1px dashed var(--border-strong)',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* 공개 상태 */}
          <div className={cn(CARD_CLASS, 'p-5')}>
            <h3 className={CARD_TITLE_CLASS}>공개 상태</h3>
            <div className="flex flex-col gap-2.5">
              {VISIBILITY.map(({ id, label, desc }) => {
                const sel = visibility === id;
                return (
                  <label
                    key={id}
                    className={cn(
                      'relative flex items-start gap-2.5 p-2.5 rounded-md cursor-pointer border',
                      sel
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-border bg-transparent',
                    )}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={id}
                      checked={sel}
                      onChange={() => setVisibility(id)}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    />
                    <span
                      aria-hidden
                      className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-[var(--surface)]"
                      style={{
                        marginTop: 2,
                        width: 14,
                        height: 14,
                        border:
                          '1.5px solid ' +
                          (sel ? 'var(--primary)' : 'var(--border-strong)'),
                      }}
                    >
                      {sel && (
                        <span
                          className="rounded-full bg-[var(--primary)]"
                          style={{ width: 7, height: 7 }}
                        />
                      )}
                    </span>
                    <span className="flex-1 text-xs">
                      <span className="font-medium block">{label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {desc}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 로스팅 일정 */}
          <div className={cn(CARD_CLASS, 'p-5')}>
            <h3 className={CARD_TITLE_CLASS}>로스팅 일정</h3>
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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--foreground)] tracking-[-0.005em] flex items-center gap-1">
        {label}
        {required && <span className="text-[var(--primary)]">*</span>}
      </label>
      {children}
      {hint && (
        <div className="pl-2.5 text-xs text-muted-foreground">{hint}</div>
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
    <div className="flex items-center gap-2 px-2.5 h-[34px] border border-input rounded-md has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:border-ring bg-[var(--surface)]">
      {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
      <input
        {...rest}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm text-[var(--foreground)] p-0 h-full shadow-none ring-0"
      />
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
    </div>
  );
}

/* mock select — 시안과 동일하게 select like 표시 (실 select 동작은 후속) */
function FormSelect({ value }: { value: string }) {
  return (
    <div className="relative h-[34px] border border-input rounded-md bg-[var(--surface)] flex items-center px-2.5 text-sm">
      <span className="flex-1">{value}</span>
      <span className="text-muted-foreground">
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
