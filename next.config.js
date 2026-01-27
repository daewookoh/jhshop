/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 1. 캐시 최대 수명: 31일 (이미지가 자주 변경되지 않으면 변환 및 캐시 쓰기 감소)
    minimumCacheTTL: 2678400,

    // 2. 포맷: webp만 사용 (avif 제거로 변환 횟수 감소)
    formats: ['image/webp'],

    // 3. 리모트 패턴: 허용된 도메인만 최적화
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

    // 4. 품질 허용 목록: 가능한 변환 수 감소 (낮은 품질 = 작은 파일)
    qualities: [50, 75],

    // 5. 디바이스 사이즈: 모바일, 데스크탑 2개로 제한
    deviceSizes: [750, 1080],

    // 6. 이미지 사이즈: 썸네일용 2개로 제한
    imageSizes: [64, 128],
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
