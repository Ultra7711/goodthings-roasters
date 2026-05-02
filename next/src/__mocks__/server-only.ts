/* `server-only` 패키지의 vitest 환경용 빈 stub.
   production 에서는 npm 의 server-only 가 클라이언트 번들 차단을 강제하지만,
   vitest 는 그 모듈을 resolve 하지 못해 import 자체에서 실패.
   vitest.config.ts 의 alias 를 통해 이 빈 파일로 대체. */
export {};
