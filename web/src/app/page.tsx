import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * La raíz del dominio abre directamente el producto real de CIFRA (/app).
 * La presentación comercial / brochure vive en /admin/presentacion para uso ejecutivo.
 */
export default function RootEntryPage() {
  redirect('/app');
}
