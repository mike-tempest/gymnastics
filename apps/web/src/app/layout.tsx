import type { Metadata } from 'next';
import { Inter, DM_Serif_Display } from 'next/font/google';
import { Toaster } from 'sonner';

import './globals.css';
import PostHogProvider from '@/components/providers/PostHogProvider';
import QueryProvider from '@/components/providers/QueryProvider';
import SessionProvider from '@/components/providers/SessionProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const dmSerif = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Swimly - Swim Club Management',
  description: 'Comprehensive club management platform for swimming clubs',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dmSerif.variable} ${inter.className}`}>
        <QueryProvider>
          <SessionProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </SessionProvider>
        </QueryProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
