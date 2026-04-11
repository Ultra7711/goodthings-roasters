/* ══════════════════════════════════════════
   Cafe Menu (RP-5)
   프로토타입 `CAFE_MENU` 배열 + 필터/페이지네이션 유틸 이식.
   - 카페 메뉴는 **매장 메뉴 표시 전용** — 장바구니 연결 없음.
   - 사업자/일반 모드 무관 단일 UI (도매가 없음).
   ══════════════════════════════════════════ */

export type CafeCategory =
  | 'brewing'
  | 'tea'
  | 'non-coffee'
  | 'dessert'
  | 'signature'; // 시그니처는 필터 전용 (카테고리 필드는 brewing/non-coffee 를 가짐)

/** 카드 status 배지 — null 은 뱃지 미표시 */
export type CafeMenuStatus = '시즌' | '시그니처' | 'NEW' | '인기' | '품절' | '시즌 한정' | '';

/** 온도 뱃지 — 'both' 는 표시하지 않음, null 은 디저트 등 온도 무관 */
export type CafeMenuTemp = 'ice-only' | 'hot-only' | 'warm' | 'both' | null;

export type CafeMenuItem = {
  id: string;
  name: string;
  /** 데이터상의 고정 카테고리 — 'brewing' | 'tea' | 'non-coffee' | 'dessert' 중 하나 */
  cat: 'brewing' | 'tea' | 'non-coffee' | 'dessert';
  status: CafeMenuStatus;
  temp: CafeMenuTemp;
  badge2: string;
  price: number;
  desc: string;
  img: string;
  bg: string;
  menuDesc: string;
  vol: string;
  kcal: number;
  satfat: string;
  sugar: string;
  sodium: string;
  protein: string;
  caffeine: string;
  allergen: string;
};

/** 필터 키 — 'all' + 5개 카테고리 + 'signature' */
export type CafeFilterKey =
  | 'all'
  | 'signature'
  | 'brewing'
  | 'tea'
  | 'non-coffee'
  | 'dessert';

export const CAFE_FILTER_TABS: { key: CafeFilterKey; label: string; titleKr: string }[] = [
  { key: 'all',        label: '모든 메뉴', titleKr: '모든 메뉴' },
  { key: 'signature',  label: '시그니처',  titleKr: '시그니처' },
  { key: 'brewing',    label: '브루잉/커피', titleKr: '브루잉/커피' },
  { key: 'tea',        label: '티',        titleKr: '티' },
  { key: 'non-coffee', label: '논 커피',   titleKr: '논 커피' },
  { key: 'dessert',    label: '디저트',    titleKr: '디저트' },
];

export const CM_PER_PAGE = 20;

/** 카테고리 라벨 (영양 시트 헤더용) */
export const CAFE_CATEGORY_LABEL: Record<CafeMenuItem['cat'], string> = {
  brewing: 'COFFEE',
  tea: 'TEA',
  'non-coffee': 'NON-COFFEE',
  dessert: 'DESSERT',
};

/* ════════════════════════════════════════
   데이터 (프로토타입 goodthings_v1.0.html L10173 CAFE_MENU)
   이미지 경로만 public prefix 적용.
   ════════════════════════════════════════ */
export const CAFE_MENU: CafeMenuItem[] = [
  // SIGNATURE
  { id: 's01', name: '황금오렌지커피', cat: 'brewing', status: '시그니처', temp: 'ice-only', badge2: '', price: 7000, desc: '', img: '/images/cafe-menu/cm_img_gold_orange_coffee.webp', bg: '#f5eedc', menuDesc: '스페셜티 브루잉 커피와 직접 만드는 오렌지 시럽,\n그리고 부드러운 크림의 화려한 조화', vol: '355ml', kcal: 234, satfat: '2.9g', sugar: '27.5g', sodium: '59.7mg', protein: '5.0g', caffeine: '200.0mg', allergen: '우유, 고카페인 함유' },
  { id: 's02', name: '클래식 도-나쓰 커피', cat: 'brewing', status: '시그니처', temp: 'warm', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_classic_donuts_coffee.webp', bg: '#f0ebe4', menuDesc: '첫입은 차갑게, 끝은 따뜻하게..\n시그니처 크림 가득, 마시는 도-나쓰', vol: '', kcal: 294.6, satfat: '8.8g', sugar: '33.9g', sodium: '113.3mg', protein: '7.1g', caffeine: '232.5mg', allergen: '우유, 대두, 고카페인 함유' },
  { id: 's03', name: '밀크커피', cat: 'brewing', status: '시그니처', temp: 'both', badge2: '', price: 5500, desc: '', img: '/images/cafe-menu/cm_img_milk_coffee.webp', bg: '#f5f0eb', menuDesc: "굳띵즈 '가을의 밤' 블렌딩 원두를 사용한\n진한 카페라떼", vol: '350ml', kcal: 220, satfat: '4.2g', sugar: '18.5g', sodium: '95mg', protein: '6.8g', caffeine: '180mg', allergen: '우유, 고카페인 함유' },
  { id: 's04', name: '딥블랙(초코)커피', cat: 'brewing', status: '시그니처', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_deepblack_coffee.webp', bg: '#e8ddd5', menuDesc: '딥블랙 카카오 파우더를 사용한,\n진하고 고급스러운 느낌의 초콜릿 커피', vol: '380ml', kcal: 265, satfat: '5.8g', sugar: '32.0g', sodium: '108mg', protein: '6.2g', caffeine: '195mg', allergen: '우유, 고카페인 함유' },
  { id: 's05', name: '자몽허니블랙티', cat: 'non-coffee', status: '시그니처', temp: 'both', badge2: '', price: 7000, desc: '', img: '/images/cafe-menu/cm_img_grapefruit_honey_black_tea.webp', bg: '#f5e8d8', menuDesc: '스*벅스 자.허.블 뺨 때리는 굳띵즈의 자.허.블', vol: '450ml', kcal: 185, satfat: '0.0g', sugar: '38.5g', sodium: '12mg', protein: '0.5g', caffeine: '45mg', allergen: '' },
  { id: 's06', name: '말차유자', cat: 'non-coffee', status: '시그니처', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_matcha_yuzu.webp', bg: '#e4edd8', menuDesc: '상큼한 유자와 부드러운 말차 크림, 봄처럼 산뜻한 음료', vol: '380ml', kcal: 210, satfat: '2.1g', sugar: '32.0g', sodium: '45mg', protein: '3.2g', caffeine: '55mg', allergen: '우유' },
  { id: 's07', name: '스파클링 유자', cat: 'non-coffee', status: '시그니처', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_sparking_yuzu.webp', bg: '#f5f0d0', menuDesc: '과일청과 탄산수,\n그리고 사르르 녹는 소르베 한 스쿱', vol: '400ml', kcal: 145, satfat: '0.0g', sugar: '30.5g', sodium: '18mg', protein: '0.2g', caffeine: '0mg', allergen: '' },
  { id: 's08', name: '스파클링 자.망.추', cat: 'non-coffee', status: '시그니처', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_sparkling_jamangchu.webp', bg: '#f5dde0', menuDesc: '과일청과 탄산수,\n그리고 사르르 녹는 소르베 한 스쿱', vol: '400ml', kcal: 160, satfat: '0.0g', sugar: '33.0g', sodium: '15mg', protein: '0.3g', caffeine: '0mg', allergen: '' },
  // BREWING / COFFEE
  { id: 'b01', name: '블랜딩', cat: 'brewing', status: '', temp: 'both', badge2: '', price: 5000, desc: '', img: '/images/cafe-menu/cm_img_americano.webp', bg: '#ede8e0', menuDesc: '', vol: '350ml', kcal: 10, satfat: '0.0g', sugar: '0.5g', sodium: '8mg', protein: '0.3g', caffeine: '185mg', allergen: '고카페인 함유' },
  { id: 'b02', name: '싱글오리진', cat: 'brewing', status: '', temp: 'both', badge2: '', price: 7000, desc: '', img: '/images/cafe-menu/cm_img_americano.webp', bg: '#e8e0d5', menuDesc: '케냐 | 과테말라 | 에티오피아 | 페루 디카페인', vol: '350ml', kcal: 8, satfat: '0.0g', sugar: '0.3g', sodium: '6mg', protein: '0.2g', caffeine: '195mg', allergen: '고카페인 함유' },
  { id: 'b03', name: '인의동 커피', cat: 'brewing', status: '', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_americano.webp', bg: '#e0d8cc', menuDesc: '달달, 고소, 묵직한 굳띵즈 대표 커피', vol: '350ml', kcal: 12, satfat: '0.0g', sugar: '0.8g', sodium: '10mg', protein: '0.3g', caffeine: '175mg', allergen: '고카페인 함유' },
  { id: 'b04', name: '아메리카노', cat: 'brewing', status: '', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_americano.webp', bg: '#ede8e0', menuDesc: "굳띵즈 '산뜻한 오후' 블렌딩 원두를 사용한\n부드러운 산미와 깔끔한 뒷맛을 가진 커피", vol: '350ml', kcal: 8, satfat: '0.0g', sugar: '0.5g', sodium: '8mg', protein: '0.2g', caffeine: '200mg', allergen: '고카페인 함유' },
  // TEA
  { id: 't01', name: '로즈얼그레이', cat: 'tea', status: '', temp: 'both', badge2: '', price: 5000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5e8e8', menuDesc: '얼그레이와 장미의 은은한 향미가 조화로운 차', vol: '400ml', kcal: 120, satfat: '0.0g', sugar: '25.0g', sodium: '10mg', protein: '0.3g', caffeine: '40mg', allergen: '' },
  { id: 't02', name: '리프레쉬애플', cat: 'tea', status: '', temp: 'both', badge2: '', price: 5000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#d8f0e0', menuDesc: '달콤한 사과조각과 레몬향으로 산뜻함이 가득한 차', vol: '400ml', kcal: 135, satfat: '0.0g', sugar: '28.5g', sodium: '8mg', protein: '0.2g', caffeine: '30mg', allergen: '' },
  { id: 't03', name: '트로피칼민트', cat: 'tea', status: '', temp: 'both', badge2: '', price: 5000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#d8e8f0', menuDesc: '민트와 열대과일의 단맛이 어우러진 차', vol: '400ml', kcal: 110, satfat: '0.0g', sugar: '22.0g', sodium: '12mg', protein: '0.2g', caffeine: '35mg', allergen: '' },
  // NON-COFFEE
  { id: 'n01', name: '사.딸.라', cat: 'non-coffee', status: '시즌 한정', temp: 'ice-only', badge2: '', price: 6500, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5dde0', menuDesc: '사줘! 딸기 라떼!!', vol: '380ml', kcal: 245, satfat: '4.5g', sugar: '35.0g', sodium: '88mg', protein: '5.5g', caffeine: '0mg', allergen: '우유, 대두' },
  { id: 'n02', name: '말차우유', cat: 'non-coffee', status: '', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#e4edd8', menuDesc: '제주 어린잎 말차를 사용', vol: '380ml', kcal: 230, satfat: '3.8g', sugar: '28.5g', sodium: '75mg', protein: '5.8g', caffeine: '40mg', allergen: '우유, 대두' },
  { id: 'n03', name: '말차딸기우유', cat: 'non-coffee', status: '', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5dde0', menuDesc: '달콤한 딸기 우유에 말차의 깊이를 더한 음료', vol: '380ml', kcal: 255, satfat: '4.0g', sugar: '32.0g', sodium: '78mg', protein: '5.5g', caffeine: '35mg', allergen: '우유, 대두' },
  { id: 'n04', name: '딥블랙(초코)우유', cat: 'non-coffee', status: '', temp: 'both', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#e8ddd5', menuDesc: '딥블랙 카카오 파우더를 사용한,\n진하고 고급스러운 느낌의 음료', vol: '380ml', kcal: 280, satfat: '5.5g', sugar: '35.5g', sodium: '95mg', protein: '6.2g', caffeine: '20mg', allergen: '우유, 대두' },
  { id: 'n05', name: '리얼아이스티 자두 | 복숭아', cat: 'non-coffee', status: '', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5e8d8', menuDesc: '차(tea)를 직접 우려 만든 진짜 아이스티', vol: '450ml', kcal: 165, satfat: '0.0g', sugar: '34.0g', sodium: '15mg', protein: '0.3g', caffeine: '45mg', allergen: '' },
  { id: 'n06', name: '망고먹은오렌지', cat: 'non-coffee', status: '', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5f0d0', menuDesc: '굳띵즈 직원 PICK! 망고와 오렌지의 시원 상큼함 \n(feat. 코코넛젤리)', vol: '400ml', kcal: 175, satfat: '0.0g', sugar: '36.5g', sodium: '12mg', protein: '0.5g', caffeine: '0mg', allergen: '' },
  { id: 'n07', name: '밀크쉐이크', cat: 'non-coffee', status: '', temp: 'ice-only', badge2: '', price: 6000, desc: '', img: '/images/cafe-menu/cm_img_mango_in_orange.webp', bg: '#f5f0eb', menuDesc: '우유 맛이 진한 정통 밀크쉐이크', vol: '400ml', kcal: 380, satfat: '8.5g', sugar: '42.0g', sodium: '140mg', protein: '8.5g', caffeine: '0mg', allergen: '우유, 대두' },
  // DESSERT
  { id: 'd01', name: '마틸다', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_matilda.webp', bg: '#f5f0eb', menuDesc: '깊은 풍미의 리얼 초코 케이크', vol: '120g', kcal: 420, satfat: '12.5g', sugar: '38.0g', sodium: '195mg', protein: '6.5g', caffeine: '15mg', allergen: '우유, 달걀, 밀, 대두' },
  { id: 'd02', name: '우유케이크', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_milkcake.webp', bg: '#f5eedc', menuDesc: '순한 풍미의 우유 케이크', vol: '110g', kcal: 365, satfat: '10.2g', sugar: '32.0g', sodium: '165mg', protein: '5.8g', caffeine: '0mg', allergen: '우유, 달걀, 밀' },
  { id: 'd03', name: '로얄밀크티 케이크', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_royal_milk_tea_cake.webp', bg: '#ede8e0', menuDesc: '진한 홍차향 가득한 밀크티 케이크', vol: '115g', kcal: 390, satfat: '11.5g', sugar: '34.5g', sodium: '175mg', protein: '6.2g', caffeine: '25mg', allergen: '우유, 달걀, 밀' },
  { id: 'd04', name: '말차초코 케이크', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_matcha_choco_cake.webp', bg: '#e4edd8', menuDesc: '진한 말차와 달콤한 초코의 조합', vol: '115g', kcal: 405, satfat: '12.0g', sugar: '36.0g', sodium: '180mg', protein: '6.0g', caffeine: '30mg', allergen: '우유, 달걀, 밀, 대두' },
  { id: 'd05', name: '딸기피스타치오 케이크', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_strawberry_pistachio_cake.webp', bg: '#f5dde0', menuDesc: '고소한 피스타치오와 상큼한 딸기의 만남', vol: '120g', kcal: 415, satfat: '12.8g', sugar: '35.5g', sodium: '185mg', protein: '6.8g', caffeine: '0mg', allergen: '우유, 달걀, 밀, 견과류' },
  { id: 'd06', name: '티라미수', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_tiramisu.webp', bg: '#e8e0d5', menuDesc: '부드러운 티라미수 케이크', vol: '110g', kcal: 430, satfat: '13.5g', sugar: '35.0g', sodium: '190mg', protein: '7.0g', caffeine: '35mg', allergen: '우유, 달걀, 밀' },
  { id: 'd07', name: '빅토리아', cat: 'dessert', status: '', temp: null, badge2: '', price: 7500, desc: '', img: '/images/cafe-menu/cm_img_victoria.webp', bg: '#f5e8e8', menuDesc: '부드러운 크림이 가득한 빅토리아 케이크', vol: '115g', kcal: 395, satfat: '11.8g', sugar: '33.5g', sodium: '170mg', protein: '6.5g', caffeine: '0mg', allergen: '우유, 달걀, 밀' },
  { id: 'd08', name: '버터떡', cat: 'dessert', status: 'NEW', temp: null, badge2: '', price: 3000, desc: '', img: '/images/cafe-menu/cm_img_butterdduck.webp', bg: '#ECEAE6', menuDesc: '쫀득쫀득 풍미 가득 버터떡', vol: '115g', kcal: 155, satfat: '2.9g', sugar: '7g', sodium: '95mg', protein: '1g', caffeine: '0.0mg', allergen: '우유, 달걀, 밀, 쌀, 대두' },
];

/** 필터 키 → 아이템 목록 (프로토타입 renderCmGrid 의 _cmRaw 로직) */
export function filterCafeMenu(items: CafeMenuItem[], filter: CafeFilterKey): CafeMenuItem[] {
  if (filter === 'all') return items;
  if (filter === 'signature') return items.filter((i) => i.status === '시그니처');
  return items.filter((i) => i.cat === filter);
}

/** NEW 상태 카드 먼저 노출 (프로토타입 renderCmGrid sort 동일) — stable sort 보장용 index tie-breaker 포함 */
export function sortCafeMenu(items: CafeMenuItem[]): CafeMenuItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aNew = a.item.status === 'NEW' ? 0 : 1;
      const bNew = b.item.status === 'NEW' ? 0 : 1;
      return aNew - bNew || a.index - b.index;
    })
    .map(({ item }) => item);
}

/** 필터 키가 유효한지 검사 — URL query parsing 용 */
export function isCafeFilterKey(value: string | null | undefined): value is CafeFilterKey {
  return (
    value === 'all' ||
    value === 'signature' ||
    value === 'brewing' ||
    value === 'tea' ||
    value === 'non-coffee' ||
    value === 'dessert'
  );
}
