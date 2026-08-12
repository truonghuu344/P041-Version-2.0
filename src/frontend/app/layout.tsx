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
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
