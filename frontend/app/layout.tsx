import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Career Assistant',
  description: 'Tối ưu CV và phỏng vấn với AI.',
  icons: {
    icon: '/images/image2.webp',
    shortcut: '/images/image2.webp',
    apple: '/images/image2.webp',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/api-config.js"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__CAREER_API_BASE_URL__ = window.__CAREER_API_BASE_URL__ || 'https://p041-version-2-0.onrender.com/api/v1';
              window.__CAREER_API_V2_BASE_URL__ = window.__CAREER_API_V2_BASE_URL__ || 'https://p041-version-2-0.onrender.com/api/v2';
              window.__CAREER_WS_HOST__ = window.__CAREER_WS_HOST__ || 'p041-version-2-0.onrender.com';
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
