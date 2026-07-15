import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast-context';
import { StoreProvider } from '@/store/StoreProvider';
// Side-effect CSS import — Next.js types this via next-env.d.ts.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Handle environments where CSS module declarations are not found
import './globals.css';

/*
 * next/font self-hosts the font at build time (no request to Google at runtime)
 * and applies font-display: swap — the LCP fix the Playbook calls for, with no
 * third-party request on the critical path.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Task Board — Kuberya',
    template: '%s — Task Board',
  },
  description:
    'Plan, assign, and track work across your team on a simple three-column board with voice-powered task capture.',
  openGraph: {
    title: 'Task Board — Kuberya',
    description:
      'Plan, assign, and track work across your team on a simple three-column board with voice-powered task capture.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before first paint to stamp data-theme on <html>, so a dark-mode
          user never sees a white flash. It must be blocking and inline — a
          deferred script would paint the wrong theme first.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <StoreProvider>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
