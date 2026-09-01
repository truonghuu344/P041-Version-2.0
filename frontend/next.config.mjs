import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  distDir: 'build_dist',
  images: {
    unoptimized: true,
  },
  trailingSlash: false,
};

export default nextConfig;
