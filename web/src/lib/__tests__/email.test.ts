import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('correo sin servicio configurado', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('en producción no escribe el cuerpo (ni el enlace de cambio de clave) en los registros', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SMTP_HOST', '');
    const logs: string[] = [];
    const keep = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
    vi.spyOn(console, 'info').mockImplementation(keep);
    vi.spyOn(console, 'log').mockImplementation(keep);
    vi.spyOn(console, 'warn').mockImplementation(keep);
    vi.spyOn(console, 'error').mockImplementation(keep);

    const { sendEmail } = await import('../notify/email');
    const res = await sendEmail({
      to: 'persona@ejemplo.co',
      subject: 'Restablece tu contraseña en CIFRA',
      text: 'Abre https://cifra.test/restablecer/token-secreto-123',
      html: '<a href="https://cifra.test/restablecer/token-secreto-123">Crear nueva contraseña</a>',
    });

    expect(res).toEqual({ sent: false, transport: 'log' });
    const all = logs.join('\n');
    expect(all).not.toContain('token-secreto-123');
    expect(all).not.toContain('persona@ejemplo.co');
    expect(all).toContain('no hay servicio de correo');
  });
});
