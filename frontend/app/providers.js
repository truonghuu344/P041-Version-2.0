'use client';

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      value={{
        light: 'light-mode',
        dark: 'dark-mode'
      }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
