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

import './BizInquiryPage.css';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { shakeFields } from '@/lib/shakeFields';
import { TextField } from '@/components/ui/TextField';
import { Textarea } from '@/components/ui/Textarea';
import { useInputNav } from '@/hooks/useInputNav';
import { usePhoneFormat } from '@/hooks/usePhoneFormat';
import { isValidEmail, isValidKoreanBizRegNum } from '@/lib/validation';
import { submitBizInquiry } from '@/lib/bizSubmit';
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

/* warn 상태 키 — 필수 필드 6 개 + 업종 드롭다운 + 개인정보 동의 (S243-A-2) */
type WarnKey = 'name' | 'email' | 'phone' | 'company' | 'address' | 'message' | 'type' | 'consent';
/** handleTextChange에서 warn 해제 대상 키 집합 */
const WARN_CLEARABLE_KEYS = new Set<WarnKey>(['name', 'email', 'phone', 'company', 'address', 'message']);
/* localStorage 임시 저장 key (S243-B). 페이지 이탈 후 복원. */
const DRAFT_STORAGE_KEY = 'gtr:biz-inquiry-draft';

const REQUIRED_TEXT_FIELDS: { key: Exclude<WarnKey, 'type' | 'consent'>; label: string }[] = [
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
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  /* 외부 클릭 시 드롭다운 닫기 — 다른 컴포넌트(인풋·다른 드롭다운·버튼) 동작 차단 + 닫힘만 (S243).
     - pointerdown capture: 인풋 focus 차단 (focus 는 mousedown/pointerdown 에 발동 — click 보다 빠름)
     - click capture: button onClick / Link navigate 차단
     둘 다 stopPropagation + preventDefault. setOpenDropdown 은 pointerdown 에서만 호출 (중복 방지). */
  useEffect(() => {
    if (!openDropdown) return;
    function onCapture(e: Event) {
      const target = e.target as HTMLElement;
      const openField = document.querySelector('.bi-dropdown-field.open');
      if (openField && openField.contains(target)) return;
      e.stopPropagation();
      e.preventDefault();
      if (e.type === 'pointerdown') {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('pointerdown', onCapture, true);
    document.addEventListener('click', onCapture, true);
    return () => {
      document.removeEventListener('pointerdown', onCapture, true);
      document.removeEventListener('click', onCapture, true);
    };
  }, [openDropdown]);

  /* 폼 리셋 — localStorage draft 도 클리어 (S243-B) */
  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setWarns(new Set());
    setPhoneHelper({ text: '전화번호를 입력하세요.', warn: false });
    setRegHelper({ text: '예: 123-45-67890', warn: false });
    setOpenDropdown(null);
    setConsent(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* localStorage 비활성/full 등 — 무시 */
    }
  }, []);

  /* localStorage 복원 (S243-B) — mount 1회만. 'use client' 라 SSR 영향 없음.
     Activity preserve (page navigate 갔다 돌아오기) 시엔 component state 가 유지되어
     이 effect 가 다시 실행되지 않음 → 중복 덮어쓰기 없음.
     S252: consent 는 복원 대상 제외 — PIPA 개인정보 동의는 매번 명시 동의 필요. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        form?: Partial<FormState>;
      };
      if (saved.form) setForm((prev) => ({ ...prev, ...saved.form }));
    } catch {
      /* parse 실패 / disabled — 무시 */
    }
  }, []);

  /* localStorage 저장 (S243-B) — form 변경 시 즉시 저장.
     INITIAL_FORM 상태(빈 폼) 일 땐 저장 안 함 (불필요한 쓰기 회피).
     S252: consent 는 저장 대상 제외 — PIPA 매번 명시 동의 정책. */
  useEffect(() => {
    const isEmpty = Object.entries(form).every(([, v]) =>
      Array.isArray(v) ? v.length === 0 : v === '',
    );
    if (isEmpty) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ form }));
    } catch {
      /* quota 초과 / disabled — 무시 */
    }
  }, [form]);

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

  /* React 19 Activity preserve — 다른 페이지에서 /biz-inquiry 복귀 시
     보존된 openDropdown 으로 드롭다운이 열린 채 보이는 회귀 차단.
     폼 입력값은 보존 (UX 의도) — 드롭다운 상태만 닫는다. */
  useEffect(() => {
    function onRouteChange(e: Event) {
      if ((e as CustomEvent<string>).detail !== '/biz-inquiry') return;
      setOpenDropdown(null);
    }
    window.addEventListener('gtr:route-change', onRouteChange);
    return () => window.removeEventListener('gtr:route-change', onRouteChange);
  }, []);

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
    if (digits.length === 0) return;
    if (digits.length < 10) {
      setRegHelper({ text: '사업자등록번호 10자리를 입력하세요.', warn: true });
      return;
    }
    /* S243-B: 10자리 입력 완료 후 국세청 체크섬 알고리즘 검증 */
    if (!isValidKoreanBizRegNum(form.regNum)) {
      setRegHelper({ text: '사업자등록번호 형식이 올바르지 않습니다.', warn: true });
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

  /* 제출 (S243-A-2) — 검증 + submitBizInquiry server action + 로딩/에러 처리. */
  async function handleSubmit() {
    if (isSubmitting) return;

    const next = new Set<WarnKey>();
    REQUIRED_TEXT_FIELDS.forEach(({ key }) => {
      if (!form[key].trim()) next.add(key);
    });
    if (!form.type) next.add('type');
    if (!consent) next.add('consent');

    setWarns(next);

    if (next.size > 0) {
      /* shake + 첫 에러로 스크롤. consent 미체크는 .bi-consent-warn 도 포함. */
      requestAnimationFrame(() => {
        shakeFields(bodyRef.current);
        const first = bodyRef.current?.querySelector(
          '.chp-field.input-warn, .bi-input-warn, .bi-consent-warn',
        );
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitBizInquiry({
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        bizType: form.type,
        address: form.address,
        regNum: form.regNum,
        equipment: form.equipment,
        currentBean: form.currentBean,
        products: form.products,
        monthlyVolume: form.volume,
        deliveryCycle: form.cycle,
        message: form.message,
        consent: true,
      });

      if (!result.ok) {
        const baseMsg =
          result.error === 'invalid_consent'
            ? '개인정보 수집·이용 동의가 필요합니다.'
            : result.error === 'invalid_input'
              ? '입력값을 확인해 주세요.'
              : '문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        const msg = result.detail ? `${baseMsg} [DEV] ${result.detail}` : baseMsg;
        show(msg, 5000);
        return;
      }

      show('문의가 접수되었습니다. 확인 후 빠르게 연락드리겠습니다.', 3500);
      resetForm();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (err) {
      console.error('[biz-inquiry] submit unexpected error', err);
      show('네트워크 오류로 전송에 실패했습니다. 다시 시도해 주세요.', 3500);
    } finally {
      setIsSubmitting(false);
    }
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

          {/* 개인정보 수집·이용 동의 (PIPA 필수 · S243-A-2) */}
          <label
            className={`bi-consent-row${warns.has('consent') ? ' bi-consent-warn' : ''}`}
          >
            <input
              type="checkbox"
              className="bi-consent-input"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) {
                  setWarns((prev) => {
                    if (!prev.has('consent')) return prev;
                    const next = new Set(prev);
                    next.delete('consent');
                    return next;
                  });
                }
              }}
            />
            <span className="bi-consent-text">
              {/* S252: prefix 는 모바일에서 hide (bi-consent-prefix). 데스크탑은
                  full 문구 유지. JSX leading 공백 의존 회피 위해 Link 와 suffix
                  텍스트는 같은 줄에 두어 공백 0개로 붙임. */}
              <span className="bi-consent-prefix">비즈니스 문의 처리를 위한 </span>
              <Link
                href="/legal/privacy"
                className="bi-consent-link"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >개인정보 수집·이용</Link>에 동의합니다.
            </span>
          </label>

          {/* 폼 최하단에서 Enter 네비게이션 타겟이 없어도 OK */}
          <button
            className="bi-submit-btn"
            id="bi-submit-btn"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-gtr-tap
          >
            {isSubmitting ? '전송 중...' : '문의 보내기'}
          </button>
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
  /* S243-B 키보드 접근성: ArrowUp/Down 으로 옵션 이동, Enter/Space 로 선택,
     ESC/Tab 으로 닫기. aria-activedescendant 로 active option 식별. */
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const optionId = (idx: number) => `${id}-option-${idx}`;

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [open, options, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onToggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => (i < 0 ? 0 : (i + 1) % options.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) onSelect(options[focusedIndex].value);
        break;
      case 'Tab':
        /* close 만 — browser default focus 이동 유지 */
        onToggle();
        break;
    }
  }

  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }${warn ? ' bi-input-warn' : ''}`}
    >
      <button
        className="bi-dropdown-trigger"
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          open && focusedIndex >= 0 ? optionId(focusedIndex) : undefined
        }
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
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
      <div className="bi-dropdown-list" role="listbox" id={listboxId}>
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt, idx) => (
          <div
            key={opt.value}
            id={optionId(idx)}
            role="option"
            aria-selected={opt.value === value}
            data-focused={focusedIndex === idx ? 'true' : undefined}
            className={`bi-dropdown-option${opt.value === value ? ' active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
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
  /* S243-B 키보드 접근성: single 과 동일하나 Enter/Space 는 toggle 후 close 하지 않음
     (multi-select 특성). ESC/Tab 만 close. */
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = `${id}-listbox`;
  const optionId = (idx: number) => `${id}-option-${idx}`;

  /* multi 는 Enter 후에도 열린 상태 유지 — values 변경 시 focusedIndex 가 reset 되지
     않도록 functional setter 로 valid 한 prev 보존 (S243-B fix). */
  useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
      return;
    }
    setFocusedIndex((prev) => {
      if (prev >= 0 && prev < options.length) return prev;
      const firstChecked = options.findIndex((o) => values.includes(o.value));
      return firstChecked >= 0 ? firstChecked : 0;
    });
  }, [open, options, values]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onToggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => (i < 0 ? 0 : (i + 1) % options.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        /* multi: toggle 만, close 안 함. focusedIndex 위치 유지 (useEffect functional setter). */
        e.preventDefault();
        if (focusedIndex >= 0) onSelect(options[focusedIndex].value);
        break;
      case 'Tab':
        onToggle();
        break;
    }
  }

  return (
    <div
      id={`${id}-field`}
      className={`bi-field bi-dropdown-field bi-multi-dropdown${open ? ' open' : ''}${
        hasValue ? ' has-value' : ''
      }`}
    >
      <button
        className="bi-dropdown-trigger"
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          open && focusedIndex >= 0 ? optionId(focusedIndex) : undefined
        }
        onClick={onToggle}
        onKeyDown={handleKeyDown}
      >
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
      <div className="bi-dropdown-list" role="listbox" id={listboxId} aria-multiselectable="true">
        <div className="bi-dropdown-title">{placeholderTitle}</div>
        {options.map((opt, idx) => {
          const checked = values.includes(opt.value);
          return (
            <div
              key={opt.value}
              id={optionId(idx)}
              role="option"
              aria-selected={checked}
              data-focused={focusedIndex === idx ? 'true' : undefined}
              className={`bi-dropdown-option${checked ? ' active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
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
