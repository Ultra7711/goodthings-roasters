/* ══════════════════════════════════════════
   BizInquiryPage — /biz-inquiry
   프로토타입 #biz-inquiry-page (L1055~1210 + L9919~10158) 이식.

   설계 결정:
   1. bi-* 격리
      - 프로토타입은 chp-* (체크아웃 폼) 클래스를 재사용하지만, Next.js 이식은
        파일 격리 원칙에 따라 .bi-* 전용 클래스로 모두 새로 작성한다.
        chp-* 시스템이 RP-7 결제 페이지 이식 때 별도로 들어올 예정이므로 격리 필수.

   2. 폼 검증
      - 필수: name, email, phone, company, address, message + 업종 드롭다운
      - 빈 값: input-warn + shake + helper warn 표시 + 첫 에러로 scrollIntoView
      - 전화번호 / 사업자번호: 자동 하이픈 (02 분기 / XXX-XX-XXXXX)
      - blur 시 형식 검증

   3. 커스텀 드롭다운
      - <select> 가 아닌 button + ul 구조로 프로토타입 그대로
      - 외부 클릭 시 닫힘 — useEffect 에서 document mousedown 리스너

   4. 동일 라우트 헤더 재클릭 시
      - SiteHeader 에서 Story/Shop/Menu 와 동일하게 'gtr:biz-reset' 발송 → 폼 리셋 + 스크롤 top
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import {
  BIZ_TYPE_OPTIONS,
  BIZ_VOLUME_OPTIONS,
  BIZ_CYCLE_OPTIONS,
  BIZ_PRODUCT_OPTIONS,
  type BizDropdownOption,
} from '@/lib/biz';

/* 전화번호 자동 하이픈 — 02 (서울) 와 010 (모바일) 분기 */
function formatPhone(val: string): string {
  const d = val.replace(/[^0-9]/g, '');
  if (d.startsWith('02')) {
    const n = d.slice(0, 10);
    if (n.length <= 2) return n;
    if (n.length <= 6) return n.slice(0, 2) + '-' + n.slice(2);
    return n.slice(0, 2) + '-' + n.slice(2, n.length - 4) + '-' + n.slice(n.length - 4);
  }
  const n = d.slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 7) return n.slice(0, 3) + '-' + n.slice(3);
  return n.slice(0, 3) + '-' + n.slice(3, n.length - 4) + '-' + n.slice(n.length - 4);
}

/* 사업자등록번호 자동 하이픈 (XXX-XX-XXXXX) */
function formatBizReg(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 10);
  if (d.length > 5) return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
  if (d.length > 3) return d.slice(0, 3) + '-' + d.slice(3);
  return d;
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  type: string;
  address: string;
  regNum: string;
  equipment: string;
  currentBean: string;
  products: string[];
  volume: string;
  cycle: string;
  message: string;
};

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  type: '',
  address: '',
  regNum: '',
  equipment: '',
  currentBean: '',
  products: [],
  volume: '',
  cycle: '',
  message: '',
};

/* warn 상태 키 — 필수 필드 6 개 + 업종 드롭다운 */
type WarnKey = 'name' | 'email' | 'phone' | 'company' | 'address' | 'message' | 'type';
const REQUIRED_TEXT_FIELDS: { key: Exclude<WarnKey, 'type'>; label: string }[] = [
  { key: 'name', label: '고객명' },
  { key: 'email', label: '이메일' },
  { key: 'phone', label: '전화번호' },
  { key: 'company', label: '상호명' },
  { key: 'address', label: '사업장 주소' },
  { key: 'message', label: '요청 사항' },
];

export default function BizInquiryPage() {
  const { show } = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [warns, setWarns] = useState<Set<WarnKey>>(new Set());
  const [phoneHelper, setPhoneHelper] = useState<{ text: string; warn: boolean }>({
    text: '전화번호를 입력하세요.',
    warn: false,
  });
  const [regHelper, setRegHelper] = useState<{ text: string; warn: boolean }>({
    text: '예: 123-45-67890',
    warn: false,
  });

  /* 드롭다운 open 상태 — 한 번에 하나만 */
  const [openDropdown, setOpenDropdown] = useState<'type' | 'volume' | 'cycle' | null>(null);

  /* 외부 클릭 시 드롭다운 닫기 */
  useEffect(() => {
    if (!openDropdown) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.bi-dropdown-field')) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openDropdown]);

  /* 폼 리셋 */
  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setWarns(new Set());
    setPhoneHelper({ text: '전화번호를 입력하세요.', warn: false });
    setRegHelper({ text: '예: 123-45-67890', warn: false });
    setOpenDropdown(null);
  }, []);

  /* SiteHeader 의 Wholesale 링크 재클릭 시 발송되는 'gtr:biz-reset' 수신
     → 스크롤 top + 폼 리셋 (samepage_reentry_animation 패턴) */
  useEffect(() => {
    function onReset() {
      window.scrollTo({ top: 0, behavior: 'instant' });
      resetForm();
    }
    window.addEventListener('gtr:biz-reset', onReset);
    return () => window.removeEventListener('gtr:biz-reset', onReset);
  }, [resetForm]);

  /* 입력 시 warn 해제 헬퍼 */
  function clearWarn(key: WarnKey) {
    setWarns((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleTextChange<K extends keyof FormState>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    if ((['name', 'email', 'phone', 'company', 'address', 'message'] as const).includes(key as never)) {
      clearWarn(key as WarnKey);
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhone(e.target.value);
    setForm((f) => ({ ...f, phone: formatted }));
    clearWarn('phone');
    setPhoneHelper((h) => ({ ...h, warn: false }));
  }

  function handlePhoneBlur() {
    const digits = form.phone.replace(/\D/g, '');
    const minLen = digits.startsWith('02') ? 9 : 10;
    if (digits.length > 0 && digits.length < minLen) {
      setWarns((prev) => new Set(prev).add('phone'));
      setPhoneHelper({
        text: '잘못된 형식입니다. (예: 010-1234-5678 / 02-1234-5678)',
        warn: true,
      });
    }
  }

  function handleRegChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatBizReg(e.target.value);
    setForm((f) => ({ ...f, regNum: formatted }));
    setRegHelper({ text: '예: 123-45-67890', warn: false });
  }

  function handleRegBlur() {
    const digits = form.regNum.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      setRegHelper({ text: '사업자등록번호 10자리를 입력하세요.', warn: true });
    }
  }

  function toggleProduct(value: string) {
    setForm((f) => ({
      ...f,
      products: f.products.includes(value)
        ? f.products.filter((p) => p !== value)
        : [...f.products, value],
    }));
  }

  function selectDropdown(field: 'type' | 'volume' | 'cycle', value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setOpenDropdown(null);
    if (field === 'type') clearWarn('type');
  }

  /* 제출 — 필수 검증 + showToast + 리셋 */
  function handleSubmit() {
    const next = new Set<WarnKey>();
    REQUIRED_TEXT_FIELDS.forEach(({ key }) => {
      if (!form[key].trim()) next.add(key);
    });
    if (!form.type) next.add('type');

    setWarns(next);

    if (next.size > 0) {
      /* 첫 에러로 스크롤 — DOM 쿼리 후 비동기 (setState 반영 대기) */
      requestAnimationFrame(() => {
        const first = bodyRef.current?.querySelector('.bi-input-warn');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    show('문의가 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.', 3500);
    resetForm();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* Enter 키 다음 필드 이동 — textarea 제외 */
  function handleEnterNext(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = Array.from(
      bodyRef.current?.querySelectorAll<HTMLInputElement>('.bi-input:not(.bi-textarea)') ?? [],
    );
    const idx = inputs.indexOf(e.currentTarget);
    const next = inputs[idx + 1];
    if (next) next.focus();
  }

  return (
    <div id="bi-body" ref={bodyRef} data-header-theme="light">
      {/* ── 좌측: 타이틀 ── */}
      <div id="bi-left">
        <div id="bi-page-title">비즈니스 문의</div>
        <p id="bi-page-desc">
          카페, 레스토랑, 오피스 등<br />
          맞춤 원두 납품을 상담해 드립니다.
        </p>
        <p id="bi-page-note">
          <svg
            className="bi-note-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3,11h3c1.1,0,2,.9,2,2v3c0,1.1-.9,2-2,2h-1c-1.1,0-2-.9-2-2v-5ZM3,11C3,6,7,2,12,2s9,4,9,9M21,11v5c0,1.1-.9,2-2,2h-1c-1.1,0-2-.9-2-2v-3c0-1.1.9-2,2-2h3Z" />
            <path d="M21,16v2c0,2.2-1.8,4-4,4h-5" />
          </svg>
          확인 후 영업일 1–2일 내 연락드리겠습니다.
        </p>
      </div>

      {/* ── 우측: 폼 ── */}
      <div id="bi-right">
        {/* 연락처 */}
        <FormSection label="연락처">
          <BiTextField
            id="bi-name"
            label="고객명 *"
            helper="고객명을 입력하세요."
            value={form.name}
            warn={warns.has('name')}
            autoComplete="name"
            onChange={(v) => handleTextChange('name', v)}
            onKeyDown={handleEnterNext}
          />
          <BiTextField
            id="bi-email"
            label="이메일 *"
            helper="이메일 주소를 입력하세요."
            type="email"
            value={form.email}
            warn={warns.has('email')}
            autoComplete="email"
            onChange={(v) => handleTextChange('email', v)}
            onKeyDown={handleEnterNext}
          />
          <BiTextField
            id="bi-phone"
            label="전화번호 *"
            helper={phoneHelper.text}
            helperWarn={phoneHelper.warn}
            type="tel"
            value={form.phone}
            warn={warns.has('phone')}
            autoComplete="tel"
            onChange={(v) => {
              /* 자동 하이픈은 별도 핸들러를 써야 cursor preservation 가능하지만,
                 React controlled input 환경에서는 단순화. */
              const fakeEvent = { target: { value: v } } as React.ChangeEvent<HTMLInputElement>;
              handlePhoneChange(fakeEvent);
            }}
            onBlur={handlePhoneBlur}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 사업체 정보 */}
        <FormSection label="사업체 정보">
          <BiTextField
            id="bi-company"
            label="상호명 *"
            helper="상호명을 입력하세요."
            value={form.company}
            warn={warns.has('company')}
            onChange={(v) => handleTextChange('company', v)}
            onKeyDown={handleEnterNext}
          />
          <BiDropdown
            id="bi-type"
            label="업종 *"
            options={BIZ_TYPE_OPTIONS}
            value={form.type}
            open={openDropdown === 'type'}
            warn={warns.has('type')}
            onToggle={() => setOpenDropdown((o) => (o === 'type' ? null : 'type'))}
            onSelect={(v) => selectDropdown('type', v)}
            placeholderTitle="업종 선택"
          />
          <BiTextField
            id="bi-address"
            label="사업장 주소 *"
            helper="시/구/동 수준으로 입력하세요."
            value={form.address}
            warn={warns.has('address')}
            onChange={(v) => handleTextChange('address', v)}
            onKeyDown={handleEnterNext}
          />
          <BiTextField
            id="bi-reg-num"
            label="사업자등록번호"
            helper={regHelper.text}
            helperWarn={regHelper.warn}
            type="tel"
            value={form.regNum}
            maxLength={12}
            onChange={(v) => {
              const fakeEvent = { target: { value: v } } as React.ChangeEvent<HTMLInputElement>;
              handleRegChange(fakeEvent);
            }}
            onBlur={handleRegBlur}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 현재 환경 */}
        <FormSection label="현재 환경">
          <BiTextField
            id="bi-equipment"
            label="보유 장비"
            helper="에스프레소 머신, 그라인더 등"
            value={form.equipment}
            onChange={(v) => handleTextChange('equipment', v)}
            onKeyDown={handleEnterNext}
          />
          <BiTextField
            id="bi-current-bean"
            label="사용 중인 원두"
            value={form.currentBean}
            onChange={(v) => handleTextChange('currentBean', v)}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 납품 요건 */}
        <FormSection label="납품 요건">
          <div className="bi-check-group">
            <p className="bi-check-label">관심 제품 (복수 선택 가능)</p>
            <div className="bi-check-row">
              {BIZ_PRODUCT_OPTIONS.map((opt) => {
                const checked = form.products.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`bi-check-item${checked ? ' checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <BiDropdown
            id="bi-volume"
            label="예상 월 사용량"
            options={BIZ_VOLUME_OPTIONS}
            value={form.volume}
            open={openDropdown === 'volume'}
            onToggle={() => setOpenDropdown((o) => (o === 'volume' ? null : 'volume'))}
            onSelect={(v) => selectDropdown('volume', v)}
            placeholderTitle="예상 월 사용량"
          />
          <BiDropdown
            id="bi-cycle"
            label="희망 납품 주기"
            options={BIZ_CYCLE_OPTIONS}
            value={form.cycle}
            open={openDropdown === 'cycle'}
            onToggle={() => setOpenDropdown((o) => (o === 'cycle' ? null : 'cycle'))}
            onSelect={(v) => selectDropdown('cycle', v)}
            placeholderTitle="희망 납품 주기"
          />
        </FormSection>

        {/* 문의 내용 */}
        <FormSection label="문의 내용">
          <div className={`bi-field${warns.has('message') ? ' bi-input-warn' : ''}`}>
            <textarea
              id="bi-message"
              className="bi-input bi-textarea"
              placeholder=" "
              rows={5}
              value={form.message}
              onChange={(e) => handleTextChange('message', e.target.value)}
            />
            <label className="bi-floating-label" htmlFor="bi-message">
              요청 사항 *
            </label>
            <div
              className={`bi-helper${warns.has('message') ? ' visible warn' : ''}`}
              id="bi-message-helper"
            >
              궁금한 점이나 요청 사항을 자유롭게 적어주세요.
            </div>
          </div>
          <button
            className="bi-submit-btn"
            id="bi-submit-btn"
            type="button"
            onClick={handleSubmit}
          >
            문의 보내기
          </button>
          <p id="bi-privacy-note">제출 시 개인정보 처리방침에 동의하게 됩니다.</p>
          <div id="bi-privacy-link-wrap">
            <span className="bi-privacy-link">개인정보 처리방침</span>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─── */

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bi-form-section">
      <div className="bi-section-label">{label}</div>
      <div className="bi-section-fields">{children}</div>
    </div>
  );
}

type BiTextFieldProps = {
  id: string;
  label: string;
  helper?: string;
  helperWarn?: boolean;
  type?: string;
  value: string;
  warn?: boolean;
  autoComplete?: string;
  maxLength?: number;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

function BiTextField({
  id,
  label,
  helper,
  helperWarn,
  type = 'text',
  value,
  warn,
  autoComplete,
  maxLength,
  onChange,
  onBlur,
  onKeyDown,
}: BiTextFieldProps) {
  const [focused, setFocused] = useState(false);
  /* helper 표시 규칙 (프로토타입 동일):
     - warn 상태면 항상 보임
     - 비-warn 상태면 focus 시에만 보임 */
  const helperVisible = (helperWarn || warn) || focused;
  return (
    <div className={`bi-field${warn ? ' bi-input-warn' : ''}`}>
      <input
        id={id}
        className="bi-input"
        type={type}
        placeholder=" "
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      <label className="bi-floating-label" htmlFor={id}>
        {label}
      </label>
      {helper && (
        <div
          className={`bi-helper${helperVisible ? ' visible' : ''}${
            helperWarn || warn ? ' warn' : ''
          }`}
        >
          {helper}
        </div>
      )}
      {value && (
        <button
          type="button"
          className="bi-input-action bi-clear-btn visible"
          aria-label="삭제"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange('')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12,3C7.1,3,3,7,3,12s4.1,9,9,9,9-4,9-9S17,3,12,3ZM15.7,14.3c.4.4.4,1,0,1.4-.4.4-.5.3-.7.3s-.5,0-.7-.3l-2.3-2.3-2.3,2.3c-.2.2-.5.3-.7.3s-.5,0-.7-.3c-.4-.4-.4-1,0-1.4l2.3-2.3-2.3-2.3c-.4-.4-.4-1,0-1.4.4-.4,1-.4,1.4,0l2.3,2.3,2.3-2.3c.4-.4,1-.4,1.4,0,.4.4.4,1,0,1.4l-2.3,2.3,2.3,2.3Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

type BiDropdownProps = {
  id: string;
  label: string;
  options: BizDropdownOption[];
  value: string;
  open: boolean;
  warn?: boolean;
  placeholderTitle: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

function BiDropdown({
  id,
  label,
  options,
  value,
  open,
  warn,
  placeholderTitle,
  onToggle,
  onSelect,
}: BiDropdownProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';
  const hasValue = !!value;
  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }${warn ? ' bi-input-warn' : ''}`}
    >
      <button className="bi-dropdown-trigger" type="button" onClick={onToggle}>
        <span className="bi-dropdown-value">{selectedLabel}</span>
        <svg
          className="bi-dropdown-arrow"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6,9l6,6,6-6" />
        </svg>
      </button>
      <label className="bi-floating-label">{label}</label>
      <div className="bi-dropdown-list">
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`bi-dropdown-option${opt.value === value ? ' active' : ''}`}
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}
