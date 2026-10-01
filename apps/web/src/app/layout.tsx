import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = { title: { default: APP_NAME, template: `%s · ${APP_NAME}` } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
