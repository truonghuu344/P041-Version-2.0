import type { Metadata } from 'next';
import { Quicksand } from 'next/font/google';
import type { ReactNode } from 'react';

import '../style.css';
import { ThemeProvider } from './providers';

const quicksand = Quicksand({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-quicksand',
});

export const metadata: Metadata = {
  title: 'CV Assistant – Career Copilot AI',
  description: 'Nâng cấp CV và phỏng vấn với AI Agent.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={quicksand.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
