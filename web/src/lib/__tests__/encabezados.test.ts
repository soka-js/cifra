import { describe, expect, it } from 'vitest';
import config from '../../../next.config';

/**
 * Los permisos del navegador que da el sitio. La caja necesita la cámara para escanear el QR del
 * cliente y el mapa de ofertas la ubicación; con `camera=()` o `geolocation=()` el navegador los
 * niega sin preguntar y esos botones nunca funcionan.
 */
describe('encabezados de seguridad', () => {
  it('cámara y ubicación solo para CIFRA misma; micrófono para nadie', async () => {
    const rules = (await config.headers?.()) ?? [];
    const all = rules.find((r) => r.source === '/:path*');
    const policy = all?.headers.find((h) => h.key === 'Permissions-Policy')?.value ?? '';
    const features = Object.fromEntries(
      policy.split(',').map((part) => {
        const [name, allow] = part.trim().split('=');
        return [name, allow];
      }),
    );
    expect(features).toEqual({ camera: '(self)', microphone: '()', geolocation: '(self)' });
  });

  it('ninguna ruta vuelve a cerrar la cámara o la ubicación por encima de la regla general', async () => {
    const rules = (await config.headers?.()) ?? [];
    const overrides = rules.filter((r) => r.source !== '/:path*' && r.headers.some((h) => h.key === 'Permissions-Policy'));
    expect(overrides).toEqual([]);
  });
});
