import '../style.css';

export const metadata = {
  title: 'Career Copilot X',
  description: 'Nâng cấp CV và phỏng vấn với AI Agent.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
