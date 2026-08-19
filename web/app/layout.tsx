import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HookViz — React hooks visualizer',
  description:
    'Step through curated React hook examples and watch the fiber state, effects queue, and DOM update in real time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
