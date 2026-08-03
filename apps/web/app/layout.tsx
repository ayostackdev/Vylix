import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from 'sonner';

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display'
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#f6f7fb',
};

export const metadata: Metadata = {
  title: 'Vylix Academic Hub — Your AI-Powered Study Companion',
  description: 'Clear the clutter, master your course. AI tutor, smart study agent, and offline-ready academic dashboard.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Vylix Academic Hub',
    description: 'Clear the clutter, master your course. AI-powered study companion for students.',
    siteName: 'Vylix Academic Hub',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vylix Academic Hub',
    description: 'Clear the clutter, master your course. AI-powered study companion for students.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vylix Academic Hub'
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/icon-192x192.png',
    shortcut: '/icons/icon-192x192.png'
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-startup-image" href="/splash.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=localStorage.getItem('vylix-theme')==='dark';var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();` }} />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} min-h-dvh w-full overflow-x-hidden overflow-y-auto`}>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
