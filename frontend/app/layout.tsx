import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Career Assistant',
  description: 'Tối ưu CV và phỏng vấn với AI.',
  icons: {
    icon: '/images/image2.png',
    shortcut: '/images/image2.png',
    apple: '/images/image2.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
