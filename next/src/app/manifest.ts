import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '굳띵즈 로스터스 - Good Things Roasters',
    short_name: '굳띵즈',
    description: 'good things, simply roasted. - 스페셜티 커피 로스터리',
    start_url: '/',
    display: 'browser',
    background_color: '#FBF8F3',
    theme_color: '#1E1B16',
    lang: 'ko',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
