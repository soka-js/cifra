import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Con sesión, la raíz abre el producto. Sin sesión, manda a entrar.
 * La página pública con la prueba sin cuenta llega en la Etapa 4 (ver docs/producto/BITACORA.md).
 */
export default async function RootEntryPage() {
  redirect((await getCurrentUser()) ? '/app' : '/entrar');
}
