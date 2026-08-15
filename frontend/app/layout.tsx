import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Career Assistant',
  description: 'Tối ưu CV và phỏng vấn với AI.',
  icons: {
    icon: '/images/buddy1.png',
    shortcut: '/images/buddy1.png',
    apple: '/images/buddy1.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
