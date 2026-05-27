/* `next/og` 패키지의 vitest 환경용 stub.
   production 에서는 Next.js 의 ImageResponse 가 build-time PNG 생성을 담당하지만,
   vitest 환경에서는 next/og 가 ESM-only 라 resolve 가 실패하여 src/ 전체의
   import resolution (alias 포함) 이 깨진다.
   apple-icon / opengraph-image / twitter-image 는 .test 대상이 아니므로 stub 으로 대체. */
export class ImageResponse {
  constructor(_element: unknown, _options?: unknown) {}
}
