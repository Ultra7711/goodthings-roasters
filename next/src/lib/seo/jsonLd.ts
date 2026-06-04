/* ══════════════════════════════════════════
   lib/seo/jsonLd.ts — structured data 빌더 (SEO 2차)

   순수 함수 — DB/상수 데이터를 schema.org JSON-LD 객체로 변환.
   데이터(상품·가격·이미지·영업시간)는 호출 시점 동적 주입 → 운영 변경 자동 반영.

   - organizationJsonLd()      : 전역 브랜드 (root layout)
   - localBusinessJsonLd(hours): 매장 + 영업시간 (story page · site_settings.hours 재활용)
   - productJsonLd(product)    : 상품 + 가격/재고 (shop/[slug])
   ══════════════════════════════════════════ */

import type { HoursSettings } from '@/lib/siteSettings';
import type { Product } from '@/lib/products';
import { BUSINESS_INFO } from '@/lib/constants';
import { STORY_LOCATION } from '@/lib/story';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://goodthingsroasters.com';
const BRAND_NAME = '굳띵즈 로스터스';
const BRAND_NAME_EN = 'Good Things Roasters';

/** 상대 경로(/images/...)는 절대화, storage URL(http..)은 그대로. JSON-LD image 는 절대 URL 요구. */
function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    alternateName: BRAND_NAME_EN,
    url: BASE_URL,
    logo: `${BASE_URL}/icon.svg`,
    ...(BUSINESS_INFO.email && { email: BUSINESS_INFO.email }),
    ...(BUSINESS_INFO.phone && { telephone: BUSINESS_INFO.phone }),
  };
}

/* schema.org dayOfWeek — site_settings weekly 키(0=일 ~ 6=토) 인덱스 매핑 */
const SCHEMA_DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export function localBusinessJsonLd(hours: HoursSettings): Record<string, unknown> {
  const openingHours = (Object.keys(hours.weekly) as Array<keyof HoursSettings['weekly']>)
    .map((k) => {
      const d = hours.weekly[k];
      if (!d) return null;
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAYS[Number(k)],
        opens: d.open,
        closes: d.close,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: BRAND_NAME,
    alternateName: STORY_LOCATION.name,
    url: `${BASE_URL}/story`,
    image: `${BASE_URL}/opengraph-image`,
    ...(BUSINESS_INFO.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: BUSINESS_INFO.address,
        addressCountry: 'KR',
      },
    }),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: STORY_LOCATION.lat,
      longitude: STORY_LOCATION.lng,
    },
    ...(BUSINESS_INFO.phone && { telephone: BUSINESS_INFO.phone }),
    ...(hours.enabled && openingHours.length > 0
      ? { openingHoursSpecification: openingHours }
      : {}),
  };
}

export function productJsonLd(product: Product): Record<string, unknown> {
  const priceNum = Number.parseInt(product.price.replace(/[^\d]/g, ''), 10);
  const images = product.images.map((img) => absoluteUrl(img.src));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.desc.split('\n')[0],
    ...(images.length > 0 ? { image: images } : {}),
    category: product.category,
    brand: { '@type': 'Brand', name: BRAND_NAME },
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/shop/${product.slug}`,
      priceCurrency: 'KRW',
      ...(Number.isFinite(priceNum) ? { price: priceNum } : {}),
      availability:
        product.status === '품절'
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
    },
  };
}
