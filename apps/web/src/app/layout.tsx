import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';

import { AppProviders } from '@/providers/app-providers';
import { ThemeProvider } from '@/providers/theme-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ChatSphere — Every conversation has a place',
    template: '%s · ChatSphere',
  },
  description:
    'ChatSphere is a real-time messaging platform for direct conversations, focused group chats, and the people you work with.',
  applicationName: 'ChatSphere',
  category: 'technology',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
