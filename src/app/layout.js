export const metadata = {
  title: 'Space Object Model Viewer',
  description: 'DSL-driven 9:16 interior wall slice viewer'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
