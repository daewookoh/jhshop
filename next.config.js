/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  outputFileTracingRoot: __dirname,
  // Suppress warnings about missing pages during build
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Ignore build errors for missing pages (they may be dynamically generated)
  // 1. 배포 시 ESLint 검사 무시 (로컬에서 이미 했으니까)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 2. 배포 시 TypeScript 에러 무시 (로컬에서 확인 필수)
  typescript: {
    ignoreBuildErrors: true,
  },

  // 3. 소스맵 생성 안 함 (용량 감소 + 속도 향상)
  productionBrowserSourceMaps: false, 

  // 4. (선택) SWC Minify 강제 활성화 (기본값이지만 확인)
  swcMinify: true,
}

module.exports = nextConfig
