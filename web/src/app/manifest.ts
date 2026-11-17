import type { MetadataRoute } from 'next';

/**
 * Lo que el celular necesita para instalar CIFRA con su ícono y abrirla sin la barra del navegador.
 * Abre en `/`: con sesión lleva al Hoy; sin sesión, a la página pública.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CIFRA: cuánto puedes gastar',
    short_name: 'CIFRA',
    description: 'Cuánto puedes gastar hasta tu próximo pago, en un solo número.',
    lang: 'es-CO',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F6F2',
    theme_color: '#FFFFFF',
    categories: ['finance'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: '¿Puedo gastar?', short_name: '¿Puedo?', url: '/app/gasto', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Caja de mi negocio', short_name: 'Caja', url: '/negocio/caja', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
