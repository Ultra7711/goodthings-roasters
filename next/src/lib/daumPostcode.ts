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

/** Daum 우편번호 스크립트를 동적 로드합니다. 이미 로드된 경우 즉시 resolve. */
function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 이미 window.daum이 존재하면 재로드 불필요
    if (typeof window !== 'undefined' && window.daum?.Postcode) {
      resolve();
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // 로드 중인 태그에 이벤트 재부착
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Daum Postcode 스크립트 로드 실패')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Daum Postcode 스크립트 로드 실패'));
    document.head.appendChild(script);
  });
}

/* ── 공개 API ── */

export type PostcodeResult = {
  zipcode: string;
  addr1: string;
};

/**
 * Daum 우편번호 검색 팝업을 열고 사용자가 선택한 결과를 반환합니다.
 * - 주소 선택 시: `{ zipcode, addr1 }` 반환
 * - 팝업 닫기(취소) 시: `null` 반환
 * - 스크립트 로드 실패 시: 예외 throw
 */
export async function openPostcode(): Promise<PostcodeResult | null> {
  await loadDaumPostcode();

  return new Promise((resolve) => {
    let selected = false;

    new window.daum!.Postcode({
      oncomplete(data) {
        selected = true;
        const addr1 = data.roadAddress || data.jibunAddress;
        resolve({ zipcode: data.zonecode, addr1 });
      },
      onclose() {
        if (!selected) {
          resolve(null);
        }
      },
    }).open();
  });
}
