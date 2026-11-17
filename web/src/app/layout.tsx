import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque';
import './globals.css';
import { Analytics } from '@/components/analytics';
import { InstallCapture } from '@/components/install';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'CIFRA: cuánto puedes gastar hasta tu próximo pago', template: '%s | CIFRA' },
  description:
    'CIFRA te dice en un solo número cuánto puedes gastar hasta tu próximo pago, después de lo que ya está comprometido. Sin pedirte la clave de tu banco.',
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
  // El color de la barra del sistema es el de la barra de la app: en el celular se ven como una sola.
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  // Deja usar el área segura del celular (la franja de gestos de abajo) para el menú.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        {children}
        <InstallCapture />
        <Analytics />
      </body>
    </html>
  );
}
