import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/lib/session';
import { SwRegister } from '@/components/SwRegister';

export const metadata: Metadata = {
  title: 'ShopNavi',
  description: '小さなお店のための、写真つき作業マニュアル',
  applicationName: 'ShopNavi',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'ShopNavi', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#b9501f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <SessionProvider>{children}</SessionProvider>
        <SwRegister />
      </body>
    </html>
  );
}
