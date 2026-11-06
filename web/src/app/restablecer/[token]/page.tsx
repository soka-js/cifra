import { and, eq, gt, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/shell';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';
import { passwordResetTokens } from '@/lib/db/schema';
import { ResetPasswordForm } from './form';

export const metadata = { title: 'Nueva contraseña' };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [valid] = await db
    .select({ tokenHash: passwordResetTokens.tokenHash })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return (
    <AuthShell
      title="Crea tu nueva contraseña"
      footer={
        <Link href="/entrar" className="font-semibold text-primary-dark underline-offset-2 hover:underline">
          Ir a entrar
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="surface-card space-y-4 p-5">
          <p className="text-[15.5px] leading-relaxed text-ink-muted">
            Este enlace ya venció o ya fue usado. Por seguridad cada enlace dura 60 minutos.
          </p>
          <Link href="/olvide-clave" className="btn-primary w-full">
            Pedir un enlace nuevo
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
