import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CIFRA: cuánto puedes gastar',
    short_name: 'CIFRA',
    description: 'Cuánto puedes gastar hasta tu próximo pago, en un solo número.',
    lang: 'es-CO',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F7F4',
    theme_color: '#0E6E63',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
