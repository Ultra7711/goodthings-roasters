/* ══════════════════════════════════════════
   daumPostcode — Daum(카카오) 우편번호 서비스 헬퍼
   스크립트는 최초 1회만 동적 로드, 이후 window.daum 캐시 재사용.
   Next.js SSR 환경에서도 안전 (window 접근은 함수 내부에만 존재).
   ══════════════════════════════════════════ */

const SCRIPT_URL =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const SCRIPT_ID = 'daum-postcode-script';

/* ── 타입 선언 ── */
type DaumPostcodeData = {
  zonecode: string;       // 새 우편번호 (5자리)
  roadAddress: string;
  jibunAddress: string;
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: (state: string) => void;
      }) => { open: () => void };
    };
  }
}

/* ── 스크립트 로더 ── */

/**
 * 모듈-레벨 싱글턴 Promise.
 * 동시 다중 호출 시 동일 Promise를 공유하여 race condition 원천 차단.
 */
let _loadPromise: Promise<void> | null = null;

function loadDaumPostcode(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.daum?.Postcode) return Promise.resolve();
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => {
        _loadPromise = null;
        reject(new Error('Daum Postcode 스크립트 로드 실패'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _loadPromise = null;
      reject(new Error('Daum Postcode 스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });

  return _loadPromise;
}

/**
 * 컴포넌트 마운트 시 스크립트를 미리 로드합니다.
 * openPostcode() 첫 호출 시 스크립트가 준비된 상태를 보장하여
 * iOS 팝업 차단 없이 동기 경로로 진입할 수 있게 합니다.
 */
export function preloadPostcode(): void {
  void loadDaumPostcode();
}

/* ── 공개 API ── */

export type PostcodeResult = {
  zipcode: string;
  addr1: string;
};

function createPostcodePromise(): Promise<PostcodeResult | null> {
  return new Promise((resolve) => {
    let selected = false;
    new window.daum!.Postcode({
      oncomplete(data) {
        selected = true;
        resolve({ zipcode: data.zonecode, addr1: data.roadAddress || data.jibunAddress });
      },
      onclose() {
        if (!selected) resolve(null);
      },
    }).open();
  });
}

/**
 * Daum 우편번호 검색 팝업을 열고 사용자가 선택한 결과를 반환합니다.
 * - 주소 선택 시: `{ zipcode, addr1 }` 반환
 * - 팝업 닫기(취소) 시: `null` 반환
 * - 스크립트 로드 실패 시: 예외 throw
 *
 * 스크립트 로드 완료 시 Promise 생성자 내부에서 .open()을 동기 호출하여
 * iOS WKWebView의 팝업 차단을 방지합니다 (생성자 콜백은 동기 실행).
 * preloadPostcode()로 마운트 시 선제 로드하면 첫 터치에서도 동기 경로 진입 보장.
 */
export function openPostcode(): Promise<PostcodeResult | null> {
  if (typeof window !== 'undefined' && window.daum?.Postcode) {
    return createPostcodePromise();
  }
  return loadDaumPostcode().then(() => createPostcodePromise());
}
