/** @type {import('next').NextConfig} */
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        source: '/backend-health',
        destination: `${apiProxyTarget}/health`,
      },
    ];
  },
};

export default nextConfig;
