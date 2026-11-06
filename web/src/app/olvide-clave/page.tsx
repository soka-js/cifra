import Link from 'next/link';
import { AuthShell } from '@/components/auth/shell';
import { ForgotPasswordForm } from './form';

export const metadata = { title: 'Recuperar contraseña' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recupera tu acceso"
      footer={
        <Link href="/entrar" className="font-semibold text-primary-dark underline-offset-2 hover:underline">
          ← Volver a entrar
        </Link>
      }
    >
      <p className="-mt-4 mb-6 text-[15.5px] leading-relaxed text-ink-muted">
        Te enviaremos un enlace de un solo uso para que elijas una contraseña nueva sin perder tus movimientos ni tu cifra.
      </p>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
