/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'supabase.co'],
  },
  outputFileTracingRoot: __dirname,
}

module.exports = nextConfig
