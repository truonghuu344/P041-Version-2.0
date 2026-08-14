import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');
const frontendRoot = dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === 'development';

const nextConfig = {
  reactStrictMode: true,
  // Keep hot-reload artifacts away from the production .next directory.
  // This also avoids transient OneDrive sync/deletion races on Windows.
  distDir: isDevelopment ? 'node_modules/.cache/next-dev' : '.next',
  output: 'standalone',
  outputFileTracingRoot: frontendRoot,
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
