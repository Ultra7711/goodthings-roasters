/* ══════════════════════════════════════════
   Products
   프로토타입 PRODUCTS 배열 + DRIP_BAG_RECIPE 이식
   ══════════════════════════════════════════ */

export type ProductImage = {
  bg: string;
  bgTheme: 'light' | 'dark';
  src: string;
};

export type ProductVolume = {
  label: string;
  price: number;
  /** 품목(용량)별 품절 플래그 — 상품 전체 품절이 아닌 특정 옵션만 품절일 때 사용 */
  soldOut?: boolean;
};

export type RecipeItem = {
  method: string;
  dose: string;
  temp: string;
  time: string;
  water: string;
};

export type FlavorNote = {
  sweet: number;
  body: number;
  aftertaste: number;
  aroma: number;
  acidity: number;
};

/** 상품 상태 배지 — null 은 뱃지 미표시 */
export type ProductStatus =
  | 'NEW'
  | '인기 NO.1'
  | '인기 NO.2'
  | '인기 NO.3'
  | '수량 한정'
  | '품절'
  | null;

/** 로스팅 단계 */
export type RoastStage = 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export type Product = {
  category: 'Coffee Bean' | 'Drip Bag';
  name: string;
  price: string;
  volumes: ProductVolume[];
  color: string;
  status: ProductStatus;
  slug: string;
  subscription: boolean;
  popup?: boolean;
  images: ProductImage[];
  desc: string;
  specs: string;
  note: FlavorNote;
  noteTags: string;
  noteColor: string;
  roastStage: RoastStage;
  recipe: RecipeItem[];
};

/** Drip Bag 공통 레시피 구조 */
export type DripBagRecipe = {
  step1: string;
  step2: string;
  step3: string;
  tip: string;
};

export const PRODUCTS: Product[] = [
  {
    category: 'Coffee Bean',
    name: '가을의 밤 Autumn Night',
    price: '14,000원',
    volumes: [
      { label: '200g', price: 14000 },
      { label: '500g', price: 34000 },
      { label: '1kg', price: 66000 },
    ],
    color: 'linear-gradient(135deg,#c9a06e,#6b3a20)',
    status: null,
    slug: 'autumn-night',
    subscription: true,
    images: [{ bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_autumn_night.webp' }],
    desc: '가을의 밤 블렌드는 굳띵즈만의 첫 번째 시그니처 블렌드로 낮은 산미와 구수하고 묵직한 단맛으로 누구에게나 호불호 없이 모든 사람들에게 사랑받는 커피입니다.\n\n가장 대중적이지만 그 안에서 작은 차이로 맛의 퀄리티를 높인 에스프레소 블렌딩으로 라떼를 즐겨 드시는 분께 추천합니다.',
    specs: '블렌드: Espresso Blend · 원산지: Brazil, Colombia, Ethiopia, India · 로스팅 포인트: Medium Dark',
    note: { sweet: 3.5, body: 3.5, aftertaste: 4, aroma: 3.5, acidity: 3 },
    noteTags: 'Nutty | Caramel | Medium | Long After',
    noteColor: '#A47146',
    roastStage: 'medium-dark',
    recipe: [
      { method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분~1분 30초', water: '120g' },
      { method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g' },
      { method: '모카포트', dose: '12g', temp: '100°C 이상', time: '4분 내외', water: '110g' },
      { method: '브루잉', dose: '18~20g', temp: '88~92°C', time: '2분 이내(뜸 30초)', water: '270~360g' },
    ],
  },
  {
    category: 'Coffee Bean',
    name: '산뜻한 오후 Refreshing Afternoon',
    price: '14,000원',
    volumes: [
      { label: '200g', price: 14000 },
      { label: '500g', price: 34000 },
      { label: '1kg', price: 64000 },
    ],
    color: 'linear-gradient(135deg,#C4C0BA,#8A8680)',
    status: null,
    slug: 'refreshing-afternoon',
    subscription: true,
    images: [{ bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_refreshing_afternoon.webp' }],
    desc: '산뜻한 오후 블렌드는 굳띵즈의 두 번째 시그니처 블렌드로, 밝은 산미는 가벼운 단맛과 하모니를 이루며 매우 높은 청량감을 느낄 수 있는 커피입니다.\n\n스페셜티 커피에서 경험할 수 있는 상큼한 산미와 청량감이 돋보이는 에스프레소 블렌딩입니다.',
    specs: '블렌드: Espresso Blend · 원산지: Colombia, Guatemala, Kenya · 로스팅 포인트: Medium',
    note: { sweet: 3, body: 2, aftertaste: 2, aroma: 4, acidity: 4 },
    noteTags: 'Fruit | Stonefruit | Syrup | Clean After',
    noteColor: '#A47146',
    roastStage: 'medium',
    recipe: [
      { method: '에어로프레스', dose: '15g', temp: '85~90°C', time: '1분~1분 30초', water: '120g' },
      { method: '에스프레소', dose: '18~20g', temp: '90~93°C', time: '25~30초', water: '34~40g' },
      { method: '모카포트', dose: '12g', temp: '100°C 이상', time: '4분 내외', water: '110g' },
      { method: '브루잉', dose: '18~20g', temp: '88~92°C', time: '2분 이내(뜸 30초)', water: '270~360g' },
    ],
  },
  {
    category: 'Drip Bag',
    name: '과테말라 와이칸 Guatemala Waykan',
    price: '2,000원',
    volumes: [
      { label: '1개', price: 2000 },
      { label: '5개', price: 10000 },
      { label: '10개', price: 20000 },
    ],
    color: 'linear-gradient(135deg,#C4C0BA,#8A8680)',
    status: null,
    slug: 'guatemala-waykan',
    subscription: false,
    images: [
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_quatemala_waykan.webp' },
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_quatemala_waykan_02.webp' },
    ],
    desc: '과테말라 와이칸의 와이칸은 마야어로 밤하늘에 빛나는 별을 뜻합니다.\n과일과 바닐라의 향미와 촉촉한 질감이 느껴지는 부드러운 매력의 커피입니다.',
    specs: '블렌드: Espresso Blend · 원산지: Guatemala · 로스팅 포인트: Medium',
    note: { sweet: 4, body: 2, aftertaste: 2, aroma: 3, acidity: 2 },
    noteTags: 'Fruity | Vanilla | Syrupy | Clean After',
    noteColor: '#A47146',
    roastStage: 'medium-light',
    recipe: [],
  },
  {
    category: 'Drip Bag',
    name: '에디오피아 부쿠 후루파 Ethiopia Buku Hurupa',
    price: '2,000원',
    volumes: [
      { label: '1개', price: 2000 },
      { label: '5개', price: 10000 },
      { label: '10개', price: 20000 },
    ],
    color: 'linear-gradient(135deg,#C4C0BA,#8A8680)',
    status: null,
    slug: 'ethiopia-buku-hurupa',
    subscription: false,
    popup: true,
    images: [
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_buku_hurufa.webp' },
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_buku_hurufa_02.webp' },
    ],
    desc: '에티오피아 부쿠 후루파는 커피의 시작 에티오피아 지역의 최고의 맛을 자랑합니다.\n싱그러운 살구와 풍성하게 다가오는 꽃향기를 느낄 수 있습니다.\n풍부한 향미와 바디감, 단맛이 좋은 특징이 있습니다.',
    specs: '블렌드: Espresso Blend · 원산지: Ethiopia · 로스팅 포인트: Light',
    note: { sweet: 3.5, body: 2.5, aftertaste: 2, aroma: 4.5, acidity: 3.5 },
    noteTags: 'Rasberry | Plum | Apricot | Creamy | Tea Like',
    noteColor: '#A47146',
    roastStage: 'light',
    recipe: [],
  },
  {
    category: 'Drip Bag',
    name: '페루 디카프 Peru De Caffein',
    price: '2,000원',
    volumes: [
      { label: '1개', price: 2000 },
      { label: '5개', price: 10000 },
      { label: '10개', price: 20000, soldOut: true },
    ],
    color: 'linear-gradient(135deg,#C4C0BA,#8A8680)',
    status: '수량 한정',
    slug: 'peru-de-caffein',
    subscription: false,
    images: [
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_peru_de_caffein.webp' },
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_peru_de_caffein_02.webp' },
    ],
    desc: '페루 디카프는 아카시아 꿀, 몽글몽글한 질감, 달콤한 과일, 밤의 고소한 맛과 함께 입안에서 묵직함이 느껴지는 커피입니다.\n카페인이 부담스럽거나 산미있는 커피를 좋아하지 않는 분에게 추천합니다.',
    specs: '블렌드: Espresso Blend · 원산지: Peru · 로스팅 포인트: Medium',
    note: { sweet: 4, body: 3.5, aftertaste: 3.5, aroma: 3, acidity: 3 },
    noteTags: 'Acacia Honey | Mellow | Round | Clean',
    noteColor: '#A47146',
    roastStage: 'medium',
    recipe: [],
  },
  {
    category: 'Drip Bag',
    name: '케냐 카간다 AA Kenya Kaganda',
    price: '2,000원',
    volumes: [
      { label: '1개', price: 2000 },
      { label: '5개', price: 10000 },
      { label: '10개', price: 20000 },
    ],
    color: 'linear-gradient(135deg,#C4C0BA,#8A8680)',
    status: '품절',
    slug: 'kenya-kaganda-aa',
    subscription: false,
    images: [
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_keyna_kaganda.webp' },
      { bg: '#ECEAE6', bgTheme: 'light', src: '/images/products/pd_img_keyna_kaganda_02.webp' },
    ],
    desc: '케냐 카간다 원두는 약간의 과일향과 진하지 않은 단맛, 적당한 바디감을 가지고 있는 매력적인 커피입니다.\n순하고 무난한 쓴맛으로 누구나 가볍게 즐길 수 있습니다.',
    specs: '블렌드: Espresso Blend · 원산지: Kenya · 로스팅 포인트: Light',
    note: { sweet: 4, body: 3.5, aftertaste: 4, aroma: 4, acidity: 3.5 },
    noteTags: 'Redplum | Blackcherry | Grape | Grape Fruit | Cacao',
    noteColor: '#A47146',
    roastStage: 'light',
    recipe: [],
  },
];

export const DRIP_BAG_RECIPE: DripBagRecipe = {
  step1: '절취선을 따라 드립백을 열어 컵에 걸어주세요.',
  step2: '커피가 가진 다양한 향을 충분히 즐겨주세요.',
  step3: '원을 두 번 그리고 10초 후, 넘치지 않게 천천히 물을 부어주세요.',
  tip: '물의 양은 180~200ml 부어주시고 물의 온도는 90~92°C가 가장 적절합니다.',
};

/** 상품명에서 한글/영문 부분을 분리. 영문 토큰이 없으면 en 은 빈 문자열. */
export function splitName(name: string): { kr: string; en: string } {
  const m = name.match(/^(.*[\uAC00-\uD7AF](?:\s+[A-Z0-9]+)*)\s+([A-Z][a-z].*)$/);
  if (!m) return { kr: name, en: '' };
  return { kr: m[1], en: m[2] };
}

/** 상품명에서 한글 부분만 추출 (카드 표시용) — splitName 래퍼 */
export function extractKrName(name: string): string {
  return splitName(name).kr;
}

/** 상품 상태 뱃지 클래스 — ShopCard · ProductDetailPage 공유 */
export function getStatusBadgeClass(status: ProductStatus): string {
  switch (status) {
    case 'NEW':       return 'sp-card-badge badge-new';
    case '인기 NO.1': return 'sp-card-badge badge-pop-1 badge-kr';
    case '인기 NO.2': return 'sp-card-badge badge-pop-2 badge-kr';
    case '인기 NO.3': return 'sp-card-badge badge-pop-3 badge-kr';
    case '수량 한정':  return 'sp-card-badge badge-ltd badge-kr';
    case '품절':      return 'sp-card-badge badge-sold badge-kr';
    default:          return 'sp-card-badge';
  }
}

/** 상품 시작 가격 포맷 (볼륨 첫 번째 기준) */
export function formatStartPrice(product: Product): string {
  if (product.volumes.length > 0) {
    return product.volumes[0].price.toLocaleString('ko-KR') + '원~';
  }
  const raw = parseInt(product.price.replace(/[^0-9]/g, ''), 10);
  return isNaN(raw) ? product.price : raw.toLocaleString('ko-KR') + '원';
}

/** 필터 키 */
export type FilterKey = 'all' | 'bean' | 'drip' | 'sub';

export const FILTER_TABS: { key: FilterKey; label: string; titleKr: string; subtitleKr: string }[] = [
  { key: 'all',  label: '모든 상품', titleKr: '모든 상품', subtitleKr: '천천히, 제대로 만듭니다.' },
  { key: 'bean', label: '커피 빈',   titleKr: '커피 빈',   subtitleKr: '천천히, 제대로 만듭니다.' },
  { key: 'drip', label: '드립백',    titleKr: '드립백',    subtitleKr: '천천히, 제대로 만듭니다.' },
  { key: 'sub',  label: '정기 배송', titleKr: '정기 배송', subtitleKr: '천천히, 제대로 만듭니다.' },
];

export const SP_PER_PAGE = 20;

export function filterProducts(products: Product[], filter: FilterKey): Product[] {
  switch (filter) {
    case 'bean': return products.filter((p) => p.category === 'Coffee Bean');
    case 'drip': return products.filter((p) => p.category === 'Drip Bag');
    case 'sub':  return products.filter((p) => p.subscription);
    default:     return products;
  }
}
