/* ══════════════════════════════════════════
   bizFormState.ts — BizInquiryPage 폼 state 타입/상수 (S264-C 분리)

   원본 인라인 (BizInquiryPage.tsx) 에서 분리:
   - FormState · INITIAL_FORM · WarnKey · WARN_CLEARABLE_KEYS
   - REQUIRED_TEXT_FIELDS · DRAFT_STORAGE_KEY
   - formatBizReg 헬퍼
   ══════════════════════════════════════════ */

export type FormState = {
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

export const INITIAL_FORM: FormState = {
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
export type WarnKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'address'
  | 'message'
  | 'type'
  | 'consent';

/** handleTextChange에서 warn 해제 대상 키 집합 */
export const WARN_CLEARABLE_KEYS = new Set<WarnKey>([
  'name',
  'email',
  'phone',
  'company',
  'address',
  'message',
]);

/* localStorage 임시 저장 key (S243-B). 페이지 이탈 후 복원. */
export const DRAFT_STORAGE_KEY = 'gtr:biz-inquiry-draft';

export const REQUIRED_TEXT_FIELDS: {
  key: Exclude<WarnKey, 'type' | 'consent'>;
  label: string;
}[] = [
  { key: 'name', label: '고객명' },
  { key: 'email', label: '이메일' },
  { key: 'phone', label: '전화번호' },
  { key: 'company', label: '상호명' },
  { key: 'address', label: '사업장 주소' },
  { key: 'message', label: '요청 사항' },
];

/* 사업자등록번호 자동 하이픈 (XXX-XX-XXXXX) */
export function formatBizReg(val: string): string {
  const d = val.replace(/\D/g, '').slice(0, 10);
  if (d.length > 5) return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
  if (d.length > 3) return d.slice(0, 3) + '-' + d.slice(3);
  return d;
}
