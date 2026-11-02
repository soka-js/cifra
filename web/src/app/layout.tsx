import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';
import { Analytics } from '@/components/analytics';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'CIFRA: cuánto puedes gastar hasta tu próximo pago', template: '%s | CIFRA' },
  description:
    'CIFRA lee los movimientos de tu cuenta y te dice en un solo número cuánto puedes gastar hasta tu próximo pago, después de lo que ya está comprometido.',
  openGraph: {
    title: 'CIFRA: cuánto puedes gastar hasta tu próximo pago',
    description: 'Un solo número antes de gastar. Sin pedirte la clave de tu banco.',
    locale: 'es_CO',
    type: 'website',
  },
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'CIFRA', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#0E6E63',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
