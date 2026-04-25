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
      - 외부 클릭 시 닫힘 — bi-dropdown-backdrop (mousedown+preventDefault 로 click 소비)

   4. 동일 라우트 헤더 재클릭 시
      - SiteHeader 에서 Story/Shop/Menu 와 동일하게 'gtr:biz-reset' 발송 → 폼 리셋 + 스크롤 top
   ══════════════════════════════════════════ */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { shakeFields } from '@/lib/shakeFields';
import { TextField } from '@/components/ui/TextField';
import { Textarea } from '@/components/ui/Textarea';
import { useInputNav } from '@/hooks/useInputNav';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { isValidEmail } from '@/lib/validation';
import {
  BIZ_TYPE_OPTIONS,
  BIZ_VOLUME_OPTIONS,
  BIZ_CYCLE_OPTIONS,
  BIZ_PRODUCT_OPTIONS,
  type BizDropdownOption,
} from '@/lib/biz';

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
/** handleTextChange에서 warn 해제 대상 키 집합 */
const WARN_CLEARABLE_KEYS = new Set<WarnKey>(['name', 'email', 'phone', 'company', 'address', 'message']);
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
  const [openDropdown, setOpenDropdown] = useState<'type' | 'volume' | 'cycle' | 'products' | null>(null);

  /* 외부 클릭 시 드롭다운 닫기 — click 캡처 단계에서 stopPropagation 으로 버튼 관통 차단 */
  useEffect(() => {
    if (!openDropdown) return;
    function onCapture(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.bi-dropdown-field')) {
        e.stopPropagation();
        setOpenDropdown(null);
      }
    }
    document.addEventListener('click', onCapture, true);
    return () => document.removeEventListener('click', onCapture, true);
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
    if (WARN_CLEARABLE_KEYS.has(key as WarnKey)) {
      clearWarn(key as WarnKey);
    }
  }

  /* 전화번호 자동 하이픈 — usePhoneFormat 훅 사용 (H-5) */
  const { handleChangeValue: handlePhoneChange } = usePhoneFormat(
    useCallback((formatted: string) => {
      setForm((f) => ({ ...f, phone: formatted }));
      setWarns((prev) => {
        if (!prev.has('phone')) return prev;
        const next = new Set(prev);
        next.delete('phone');
        return next;
      });
      setPhoneHelper((h) => ({ ...h, warn: false }));
    }, []),
  );

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

  /* 이메일 blur 검증 — 빈 값 skip, 형식 불일치 시 warn (M-2) */
  function handleEmailBlur() {
    const trimmed = form.email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setWarns((prev) => new Set(prev).add('email'));
    }
  }

  function handleRegChange(v: string) {
    const formatted = formatBizReg(v);
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
      /* shake + 첫 에러로 스크롤 — DOM 쿼리 후 비동기 (setState 반영 대기) */
      requestAnimationFrame(() => {
        shakeFields(bodyRef.current);
        /* TextField → .chp-field.input-warn / BiDropdown → .bi-input-warn */
        const first = bodyRef.current?.querySelector(
          '.chp-field.input-warn, .bi-input-warn',
        );
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    show('문의가 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.', 3500);
    resetForm();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* Enter 키 다음 필드 이동 — useInputNav 훅 사용 (chp-input / select 순회) */
  const handleEnterNext = useInputNav(bodyRef);

  return (
    <div id="bi-body" ref={bodyRef} data-header-theme="light">
      {/* ── 좌측: 타이틀 ── */}
      <div id="bi-left">
        <div id="bi-page-title">비즈니스 문의</div>
        <p id="bi-page-desc">
          카페, 레스토랑, 오피스 등 맞춤 원두 납품을 상담해 드립니다.
        </p>
        <p id="bi-page-note">
          확인 후 영업일 1~2일 내 연락드리겠습니다.
        </p>
      </div>

      {/* ── 우측: 폼 ── */}
      <div id="bi-right">
        {/* 연락처 */}
        <FormSection label="연락처">
          <TextField
            id="bi-name"
            label="고객명 *"
            helper="고객명을 입력하세요."
            value={form.name}
            error={warns.has('name') ? '고객명을 입력하세요.' : undefined}
            autoComplete="name"
            onChange={(v) => handleTextChange('name', v)}
            onKeyDown={handleEnterNext}
          />
          <TextField
            id="bi-email"
            type="email"
            label="이메일 *"
            helper="이메일 주소를 입력하세요."
            value={form.email}
            error={
              warns.has('email')
                ? form.email.trim()
                  ? '올바른 이메일 형식으로 입력하세요.'
                  : '이메일을 입력하세요.'
                : undefined
            }
            autoComplete="email"
            onChange={(v) => handleTextChange('email', v)}
            onBlur={handleEmailBlur}
            onKeyDown={handleEnterNext}
          />
          <TextField
            id="bi-phone"
            type="tel"
            label="전화번호 *"
            helper="전화번호를 입력하세요."
            value={form.phone}
            error={
              phoneHelper.warn
                ? phoneHelper.text
                : warns.has('phone')
                  ? '전화번호를 입력하세요.'
                  : undefined
            }
            autoComplete="tel"
            onChange={handlePhoneChange}
            onBlur={handlePhoneBlur}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 사업체 정보 */}
        <FormSection label="사업체 정보">
          <TextField
            id="bi-company"
            label="상호명 *"
            helper="상호명을 입력하세요."
            value={form.company}
            error={warns.has('company') ? '상호명을 입력하세요.' : undefined}
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
          <TextField
            id="bi-address"
            label="사업장 주소 *"
            helper="시/구/동 수준으로 입력하세요."
            value={form.address}
            error={warns.has('address') ? '사업장 주소를 입력하세요.' : undefined}
            onChange={(v) => handleTextChange('address', v)}
            onKeyDown={handleEnterNext}
          />
          <TextField
            id="bi-reg-num"
            type="tel"
            label="사업자등록번호"
            helper="예: 123-45-67890"
            value={form.regNum}
            error={regHelper.warn ? regHelper.text : undefined}
            maxLength={12}
            onChange={handleRegChange}
            onBlur={handleRegBlur}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 현재 환경 */}
        <FormSection label="현재 환경">
          <TextField
            id="bi-equipment"
            label="보유 장비"
            helper="에스프레소 머신, 그라인더 등"
            value={form.equipment}
            onChange={(v) => handleTextChange('equipment', v)}
            onKeyDown={handleEnterNext}
          />
          <TextField
            id="bi-current-bean"
            label="사용 중인 원두"
            helper="현재 사용 중인 원두가 있으면 입력해 주세요."
            value={form.currentBean}
            onChange={(v) => handleTextChange('currentBean', v)}
            onKeyDown={handleEnterNext}
          />
        </FormSection>

        {/* 납품 요건 */}
        <FormSection label="납품 요건">
          <BiMultiDropdown
            id="bi-products"
            label="관심 제품"
            options={BIZ_PRODUCT_OPTIONS}
            values={form.products}
            open={openDropdown === 'products'}
            onToggle={() => setOpenDropdown((o) => (o === 'products' ? null : 'products'))}
            onSelect={toggleProduct}
            placeholderTitle="복수 선택 가능"
          />
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
          <Textarea
            id="bi-message"
            label="요청 사항 *"
            helper="궁금한 점이나 요청 사항을 자유롭게 적어주세요."
            value={form.message}
            error={warns.has('message') ? '요청 사항을 입력하세요.' : undefined}
            rows={5}
            onChange={(v) => handleTextChange('message', v)}
            onClear={() => handleTextChange('message', '')}
          />
          {/* 폼 최하단에서 Enter 네비게이션 타겟이 없어도 OK */}
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

/* ── 복수 선택 드롭다운 ── */
type BiMultiDropdownProps = {
  id: string;
  label: string;
  options: BizDropdownOption[];
  values: string[];
  open: boolean;
  placeholderTitle: string;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

function BiMultiDropdown({
  id,
  label,
  options,
  values,
  open,
  placeholderTitle,
  onToggle,
  onSelect,
}: BiMultiDropdownProps) {
  const selectedLabels = options
    .filter((o) => values.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  const hasValue = values.length > 0;
  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field bi-multi-dropdown${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }`}
    >
      <button className="bi-dropdown-trigger" type="button" onClick={onToggle}>
        <span className="bi-dropdown-value">{selectedLabels}</span>
        <svg
          className="bi-dropdown-arrow"
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
          <path d="M6,9l6,6,6-6" />
        </svg>
      </button>
      <label className="bi-floating-label">{label}</label>
      <div className="bi-dropdown-list">
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt) => {
          const checked = values.includes(opt.value);
          return (
            <div
              key={opt.value}
              className={`bi-dropdown-option${checked ? ' active' : ''}`}
              onClick={() => onSelect(opt.value)}
            >
              <span className="bi-check-box">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5,12l5,5,9-9" />
                </svg>
              </span>
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
