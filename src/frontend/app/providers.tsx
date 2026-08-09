'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider> & {
  children: ReactNode;
};

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      value={{ light: 'light-mode', dark: 'dark-mode' }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
