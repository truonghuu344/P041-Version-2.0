import '../style.css';
import { ThemeProvider } from './providers';

export const metadata = {
  title: 'CV Assistant – Career Copilot AI',
  description: 'Nâng cấp CV và phỏng vấn với AI Agent.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

