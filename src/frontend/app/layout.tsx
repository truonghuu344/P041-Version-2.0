import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '../style.css';
import { ThemeProvider } from './providers';

export const metadata: Metadata = {
  title: 'CV Assistant – Career Copilot AI',
  description: 'Nâng cấp CV và phỏng vấn với AI Agent.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
