import 'server-only';

/* ══════════════════════════════════════════════════════════════════════════
   profanityCore.ts — 리뷰 욕설 분류 (Phase 2 로컬 필터 · S315)

   PROFANITY_RAW(badwords-ko 575개)를 커피 리뷰 도메인에 맞게 3분류:
   - STRONG (강)      → blocked  : 문맥무관 명백 욕설. 자동 차단(오탐 0 목표).
   - WHITELIST (제외) → 필터 안 함: "존맛·졸맛·미친(강조)·병맛" 등 긍정/강조어.
                                    raw 에 섞여 있어 watch 에서 빼야 정상 리뷰 통과.
   - WATCH (약)       → pending  : raw − STRONG − WHITELIST. 혐오·경계·모욕어.
                                    오탐 가능성 있어 자동차단 않고 어드민 검토 큐로.

   판정: 정규화(공백·숫자·특수문자 제거 + 반복 축소) 후 부분일치.
   - STRONG 히트 → blocked / WATCH 히트 → pending / 무히트 → approved
   - 결정적(같은 입력=같은 결과)·0비용·~0.1ms. throw 없음.

   참조: profanityWords.ts (raw 출처 badwords-ko MIT)
   ════════════════════════════════════════════════════════════════════════ */

import { PROFANITY_RAW } from './profanityWords';

/* ── 강 사전 (blocked) — 문맥무관 명백 욕설만 (오탐 0 목표) ──────────────── */
const STRONG_WORDS: readonly string[] = [
  // 씨발 계열
  '씨발', '시발', '씨1발', '시1발', '시팔', '씨팔', '시펄', '십팔', '씹팔', '씨벌',
  '시벌', '씨벌탱', '시벌탱', '씨볼탱', '시볼탱', '씨부럴', '시부럴', '씨부렬', '시부렬',
  '씨뷰럴', '시뷰럴', '씨뷰렬', '시뷰렬', '씨빨', '시빨', '씨뻘', '쉬발', '쉬펄', '쉬이바',
  '쉬버', '슈발', '슈벌', '슈우벌', '슈1발', '스벌', '쒸펄', '씨이발', '시이발', '씨바알',
  '씨바라', '시바라지', '시바류', '시바시바', '씨방새', '시방새', '씨버럼', '씨빠빠',
  '시미발친', '시미친발', '미시친발', '시친발미', '씨새발끼', '시새발끼',
  'ㅅㅂ', 'ㅆㅂ', 'ㅅ1발', 'ㅆ1ㅂ', 'ㅅ1ㅂ', 'tlqkf',
  // 좆 계열
  '좆', '좃', '좇같', '좆까', '좆되네', '좆팔', '죶', '봊', '족까', '후팔', '취좃', 'jot같',
  // 병신 계열
  '병신', '병1신', '븅신', '병크', '병1크', 'ㅂㅅ', 'ㅄ', '엠뷩신', '엠븽신', '엠빙신', '별창',
  // 새끼 계열
  '개새끼', '개새기', '계새끼', '괘새끼', '사새끼', '새끼야', '새끼라', '새퀴', '새킈',
  '새키', '색희', '색히', '샊기', '샊히', '새1끼', '새1키', '씹새끼', '호로새끼', '쌍놈',
  '쌍년', '썅', '쌔끼', '썌끼', '빡새끼', '샛기', '세키', '색퀴', 'ㅅㄲ', 'ㅅ끼', '은새끼',
  '샹년', '딴년', '니년', '런년', '쌍판',
  // 지랄 계열
  '지랄', '지롤', '쥐랄', '즤랄', 'ㅈㄹ', '지1랄', 'g랄',
  // 엠창/씹창 계열
  '엠창', '앰창', '엠생', '씹창', '씝창', '싑창', '씹할', '씹팔', '씹치', '씹못', '씹뻐럴',
  '십창', '씹쌔', '씹귀', '앰',
  // 창녀 계열
  '창녀', '창년', '창남', '창놈', '창넘', '화냥년', '화낭년',
  // 뻐큐 계열
  '뻐큐', '뻑큐', '빠큐', '뻑유', '뻐규', '뼈큐', '뻨큐', '빠큐',
  // 후빨/기타 명백
  '후빨', '후1빨', '염병', '옘병', '애미', '애비', '니미럴', '닝기리',
  // ── 약→강 승격 (S315) — 명백 혐오·위협은 인라인 경고 없이 작성 거부 ──
  // 인종·국적 혐오
  '짱깨', '짱개', '짱꼴라', '짱골라', '짱께', '조센징', '쪽바리', '쪽발', '쪽본', '착짱죽짱', '섬숭이',
  // 젠더 혐오
  '김치녀', '된장녀', '한녀', '보슬아치', '보징어', '상폐녀',
  // 위협·죽음 강요
  '뒈져', '뒤져라', '뒤져버', '뒤져야', '뒤졌', '뒤지겠', '뒤진다', '뒤질', '디져라', '디졌',
  '디지고', '디질', '죽어버려', '죽여버리고', '죽여불고', '죽여뿌고',
  // 정신질환 비하
  '정신병자', '정병',
];

/* ── 화이트리스트 (제외) — 커피 리뷰 긍정/강조어. watch 에서 빼서 통과시킴 ──── */
const WHITELIST_WORDS: readonly string[] = [
  // 존X / 졸X / 쫀X 긍정·축약 (커피 리뷰 극찬).
  // ⚠️ 강조부사 "존나·졸라"류는 제외 — raw 에 남겨 watch(pending) 로 보낸다(사용자 결정).
  '존맛', '존좋', '존잘', '존귀', '존귘', '존멋', '존잼', '존웃', '존버', '존싫', '존똑',
  '졸맛', '졸좋', '졸멋', '졸잼', '졸웃', '졸예', '졸싫', '쫀맛', '쫀귀', '쫀1', '쫀 맛', '쬰잘',
  // B급 감성·강조 (욕설 아님)
  '병맛', '미친~', '미친개', '미친ㅋ', '자살',
];

/* ── 정규화: 한글(완성형+자모)·영문만 남기고 공백·숫자·특수문자·이모지 제거 +
      3연속 이상 반복 글자 축소. 우회("시 발","시1발","씨@발","씨이이발") 대응. ── */
function normalizeForProfanity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

function normalizeAll(words: readonly string[]): string[] {
  const out = new Set<string>();
  for (const w of words) {
    const n = normalizeForProfanity(w);
    if (n.length >= 1) out.add(n);
  }
  return [...out];
}

/* 모듈 1회 구축 (요청마다 재생성 없음). */
const STRONG_NORM = normalizeAll(STRONG_WORDS);
const WHITELIST_NORM = new Set(normalizeAll(WHITELIST_WORDS));
const STRONG_NORM_SET = new Set(STRONG_NORM);
/* WATCH = raw − whitelist − strong (정규화 기준). 약 사전.
   ⚠️ 1글자 항목 제외 — "존1"→"존" 처럼 정규화로 짧아진 토큰이 정상어("존맛")를
   과매칭하는 것을 차단(부분일치 오탐 방지). */
const WATCH_NORM = normalizeAll(PROFANITY_RAW).filter(
  (w) => w.length >= 2 && !WHITELIST_NORM.has(w) && !STRONG_NORM_SET.has(w),
);

export type ProfanityTier = 'strong' | 'watch' | 'clean';

export type ProfanityResult = {
  tier: ProfanityTier;
  /** 매칭된 정규화 사전 단어 (어드민 검토 근거). clean 이면 null. */
  matched: string | null;
};

/** 본문을 강/약/clean 으로 분류. 결정적·동기·throw 없음. */
export function classifyProfanity(body: string): ProfanityResult {
  const norm = normalizeForProfanity(body);
  if (norm.length === 0) return { tier: 'clean', matched: null };

  for (const w of STRONG_NORM) {
    if (norm.includes(w)) return { tier: 'strong', matched: w };
  }
  for (const w of WATCH_NORM) {
    if (norm.includes(w)) return { tier: 'watch', matched: w };
  }
  return { tier: 'clean', matched: null };
}
