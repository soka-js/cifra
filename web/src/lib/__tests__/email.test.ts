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

  it('si Resend rechaza el envío (por ejemplo, destinatario fuera del modo de prueba), avisa que no salió', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 're_prueba');
    vi.stubEnv('SMTP_HOST', '');
    const logs: string[] = [];
    const keep = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
    vi.spyOn(console, 'error').mockImplementation(keep);
    vi.spyOn(console, 'warn').mockImplementation(keep);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address (dueno@ejemplo.co).' }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { sendEmail } = await import('../notify/email');
    const res = await sendEmail({ to: 'otra@ejemplo.co', subject: 'Restablece tu contraseña en CIFRA', text: 't', html: 'h' });

    expect(res.sent).toBe(false);
    const all = logs.join('\n');
    expect(all).toContain('Resend respondió 403 (validation_error)');
    expect(all).not.toContain('@ejemplo.co');
  });
});

describe('dirección pública para armar enlaces', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('en una vista previa de Vercel usa la dirección de su rama, no la de producción', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_BRANCH_URL', 'cifra-git-producto-v1-equipo.vercel.app');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://produccion.example');
    const { siteUrl } = await import('../site');
    expect(siteUrl()).toBe('https://cifra-git-producto-v1-equipo.vercel.app');
  });

  it('en producción y en local usa NEXT_PUBLIC_SITE_URL, o el respaldo si no está', async () => {
    const { siteUrl } = await import('../site');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_BRANCH_URL', 'cifra-git-main-equipo.vercel.app');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://produccion.example/');
    expect(siteUrl()).toBe('https://produccion.example');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteUrl('http://origen.local')).toBe('http://origen.local');
  });
});
