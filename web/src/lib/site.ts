/**
 * Dirección pública de la app, para armar enlaces absolutos (correo de cambio de clave, QR del
 * negocio, regreso de Google).
 *
 * En una vista previa de Vercel usa la dirección de su propia rama (`VERCEL_BRANCH_URL`). Allá
 * `NEXT_PUBLIC_SITE_URL` no existe (está solo en Production), y aunque se agregara apuntaría a
 * producción: un enlace de la vista previa que lleve a producción no sirve, porque el código del
 * enlace existe solo en la base de la vista previa.
 */
export function siteUrl(fallback = 'http://localhost:3000'): string {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`.replace(/\/$/, '');
  }
  return (process.env.NEXT_PUBLIC_SITE_URL || fallback).replace(/\/$/, '');
}
