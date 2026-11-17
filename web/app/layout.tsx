import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

const SITE = 'https://hookviz.ashishtaduce.co.in';
const DESCRIPTION =
  'HookViz replays real React executions one statement at a time. Watch the source line, hook list, effects queue and DOM change together.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'HookViz — watch React hooks run, one line at a time', template: '%s — HookViz' },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'HookViz',
    title: 'HookViz — watch React hooks run, one line at a time',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HookViz — watch React hooks run, one line at a time',
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
