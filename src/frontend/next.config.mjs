import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

export default function nextConfig(phase) {
  return {
    reactStrictMode: true,
    output: 'standalone',
    // Không dùng chung cache giữa `next dev` và `next build`: production
    // build không còn làm mất webpack chunks của dev server đang chạy.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
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
}
