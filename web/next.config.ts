import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Cámara: la caja escanea el QR del cliente. Ubicación: "usar mi ubicación" en el mapa de ofertas.
  // Solo para CIFRA misma (self), nunca para un sitio que la meta en un marco, y el navegador
  // igual le pregunta a la persona. Va en todo el sitio porque la app cambia de pantalla sin
  // recargar: el permiso lo fija la página donde se abrió el navegador, no la de la caja.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const config: NextConfig = {
  poweredByHeader: false,
  // El repo tiene el prototipo en la raíz; la app vive en web/.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['@node-rs/argon2'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
