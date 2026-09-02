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
  /**
   * Mỗi role root CHÍNH LÀ dashboard của role đó:
   *   /student · /counselor · /admin
   *
   * URL cũ `/<role>/dashboard` được redirect vĩnh viễn (308) về role root để
   * bookmark/deep-link cũ vẫn hoạt động và chỉ còn MỘT URL chuẩn cho dashboard.
   * Redirect chạy TRƯỚC rewrites nên không xung đột với các rewrite bên dưới.
   */
  async redirects() {
    return [
      { source: '/student/dashboard', destination: '/student', permanent: true },
      { source: '/counselor/dashboard', destination: '/counselor', permanent: true },
      { source: '/admin/dashboard', destination: '/admin', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
      {
        source: '/api/v2/:path*',
        destination: `${apiProxyTarget}/api/v2/:path*`,
      },
      {
        source: '/backend-health',
        destination: `${apiProxyTarget}/health`,
      },
      {
        // Trang đăng nhập dùng chung cho các vai trò (Student, Counselor, Admin).
        // Không chọn role trước khi đăng nhập — role được
        // đọc từ response của backend sau xác thực rồi mới điều hướng.
        source: '/login',
        destination: '/',
      },
      {
        source: '/login/:path*',
        destination: '/',
      },
      {
        // Cổng đăng ký công khai: /register, /register/student.
        // Counselor/Admin không có luồng tự đăng ký — được Admin cấp tài khoản.
        source: '/register',
        destination: '/',
      },
      {
        source: '/register/:path*',
        destination: '/',
      },
      {
        source: '/counselor',
        destination: '/',
      },
      {
        source: '/counselor/:path*',
        destination: '/',
      },
      {
        source: '/student',
        destination: '/',
      },
      {
        source: '/student/:path*',
        destination: '/',
      },
      {
        source: '/admin',
        destination: '/',
      },
      {
        source: '/admin/:path*',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;
