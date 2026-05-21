/* ══════════════════════════════════════════════════════════════════════════
   lib/allergenSort.ts — 알레르기 성분 정렬 + 별칭 정규화 (S245)

   배경:
   - 운영자가 cafe_menu_items.allergen 에 자유 입력 ('대두, 우유, 카카오')
   - 입력 순서대로 표시되면 메뉴마다 순서 중구난방 → 사용자 인상 저하
   - 식약처 [별표 4] 19종 표시 의무 알레르기 = 사실상 표준 표시 순서

   처리:
   1) ',' 분할 + trim + 빈 항목 제거
   2) 별칭 정규화 ('계란/달걀/난류' → '알류' 등 · DB 일관성)
   3) 중복 제거 (정규화 후 동일 항목)
   4) 정렬: 19종 우선 (별표 순) + 나머지 가나다순

   호출:
   - admin/menu/actions.ts toCafeMenuDbRow — create/update 시점에 정규화 후 DB 저장

   참조:
   - 식품의약품안전처 「식품등의 표시기준」 별표 4 (2020-09-01 잣 추가 19종)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 식약처 [별표 4] 알레르기 유발물질 19종.
 * 배열 순서 = 별표 나열 순 = 사실상 업계 표시 순서.
 */
export const STANDARD_ALLERGEN_ORDER = [
  '알류',     // 1 (가금류)
  '우유',     // 2
  '메밀',     // 3
  '땅콩',     // 4
  '대두',     // 5
  '밀',       // 6
  '고등어',   // 7
  '게',       // 8
  '새우',     // 9
  '돼지고기', // 10
  '복숭아',   // 11
  '토마토',   // 12
  '아황산류', // 13
  '호두',     // 14
  '닭고기',   // 15
  '쇠고기',   // 16
  '오징어',   // 17
  '조개류',   // 18 (굴/전복/홍합 포함)
  '잣',       // 19
] as const;

/**
 * 운영자 입력 별칭 → 식약처 공식 표기.
 * 모호한 매핑 (예: '갑각류' → 게/새우?) 은 채택하지 않음 — 안전 매핑만.
 */
const SAFE_ALIASES: Record<string, string> = {
  // 알류
  '난류': '알류',
  '계란': '알류',
  '달걀': '알류',
  '에그': '알류',
  // 우유
  '밀크': '우유',
  '유제품': '우유',
  // 대두
  '콩': '대두',
  '두유': '대두',
  // 밀
  '글루텐': '밀',
};

const STANDARD_ORDER_INDEX: Record<string, number> = Object.fromEntries(
  STANDARD_ALLERGEN_ORDER.map((name, i) => [name, i]),
);

const COLLATOR = new Intl.Collator('ko-KR');

/**
 * 단일 항목 정규화 — trim + 별칭 → 공식 표기.
 */
function normalizeOne(raw: string): string {
  const trimmed = raw.trim();
  return SAFE_ALIASES[trimmed] ?? trimmed;
}

/**
 * 운영자 입력 allergen 문자열 → 정렬·정규화된 단일 문자열.
 *
 * 예:
 *   '대두, 우유, 카카오'       → '우유, 대두, 카카오'
 *   '계란, 우유, 카카오, 밀'   → '알류, 우유, 밀, 카카오'
 *   '난류, 알류, 콩, 대두'     → '알류, 대두'  (중복 제거)
 *   ''                          → ''
 *
 * 정렬 규칙:
 *   1) 19종 우선 (별표 순)
 *   2) 19종 외 항목 = 가나다순
 *   3) 중복 제거 (정규화 후 동일 항목)
 */
export function normalizeAllergen(input: string): string {
  if (!input) return '';

  const items = input
    .split(',')
    .map(normalizeOne)
    .filter((s) => s.length > 0);

  if (items.length === 0) return '';

  /* 중복 제거 (Set 은 삽입 순서 보존 — 다음 단계 정렬로 재배치) */
  const unique = Array.from(new Set(items));

  unique.sort((a, b) => {
    const aIdx = STANDARD_ORDER_INDEX[a];
    const bIdx = STANDARD_ORDER_INDEX[b];

    /* 둘 다 19종 — 별표 순 */
    if (aIdx !== undefined && bIdx !== undefined) {
      return aIdx - bIdx;
    }
    /* 한쪽만 19종 — 19종 우선 */
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    /* 둘 다 19종 외 — 가나다 */
    return COLLATOR.compare(a, b);
  });

  return unique.join(', ');
}

/* ── 고카페인 함유 마커 동기화 (S245-P19) ─────────────────────────────── */

/** 식약처 「식품등의 표시기준」 — 1회 분량 카페인 >= 150mg 시 표시 의무. */
export const HIGH_CAFFEINE_THRESHOLD_MG = 150;
const HIGH_CAFFEINE_MARKER = '고카페인 함유';

/** caffeine 문자열 ('75mg' / '150mg') → mg 정수. 파싱 실패 0. */
function parseCaffeineMg(text: string | null | undefined): number {
  if (!text) return 0;
  const m = String(text).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * allergen 문자열에 '고카페인 함유' 마커를 caffeine 값 기준으로 동기화.
 *  - caffeine >= 150mg → 마커 보장 (없으면 추가)
 *  - caffeine <  150mg → 마커 제거 (있으면)
 *  결과는 normalizeAllergen 으로 재정렬됨 (19종 우선 + 가나다).
 *
 * 호출:
 *  - admin/menu/actions.ts toCafeMenuDbRow — DB 저장 시점 자동 동기화
 *  - scripts/normalize-high-caffeine.ts — 1회성 백필
 */
export function syncHighCaffeineMarker(
  allergen: string | null | undefined,
  caffeineText: string | null | undefined,
): string {
  const mg = parseCaffeineMg(caffeineText);
  const shouldHave = mg >= HIGH_CAFFEINE_THRESHOLD_MG;

  /* 분할 + trim + 빈 제거 + 마커 항목 제외 후 재합성 */
  const items = (allergen ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== HIGH_CAFFEINE_MARKER);

  if (shouldHave) items.push(HIGH_CAFFEINE_MARKER);

  return normalizeAllergen(items.join(', '));
}

/* ── 표시 라벨 매핑 (S245) ──────────────────────────────────────────────── */

/**
 * 표시 시점 라벨 매핑 — 일반 소비자 친숙도 보강.
 * DB 는 식약처 공식 표기 유지 · 표시만 병기.
 *
 * 적용 원칙 (최소 범위):
 * - '알류' = 식약처 공식 표기이나 일반 소비자에게 낯섦 → '알류(계란)' 병기
 * - 다른 19종 (우유/밀/땅콩/대두 등) = 이미 충분히 친숙 → 단독 표기
 */
const DISPLAY_LABEL_MAP: Record<string, string> = {
  '알류': '알류(계란)',
};

/**
 * 정규화된 알레르기 항목명 → 표시용 라벨.
 * CafeNutritionSheet 등 사용자 노출 컴포넌트에서 chip 렌더 시 호출.
 */
export function getAllergenDisplayLabel(name: string): string {
  return DISPLAY_LABEL_MAP[name] ?? name;
}
