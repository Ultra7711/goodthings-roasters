import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @node-rs/argon2 는 native binary 를 포함하므로 서버 번들에서 제외한다.
  // Next.js 가 Node.js native 모듈을 webpack 으로 처리하지 않고 런타임에 require 한다.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
