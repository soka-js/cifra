import 'server-only';
import nodemailer from 'nodemailer';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendResult {
  sent: boolean;
  transport: 'resend' | 'smtp' | 'log';
}

/**
 * Envío transaccional de correo (recuperación de contraseña, alertas y estados de cuenta).
 * Prioriza Resend HTTP API -> SMTP (Nodemailer) -> salida estructurada en consola local.
 */
export async function sendEmail(msg: OutboundEmail): Promise<EmailSendResult> {
  const from = process.env.EMAIL_FROM || 'CIFRA <no-responder@cifra.co>';

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      if (res.ok) return { sent: true, transport: 'resend' };
      // Solo el código y el tipo de error de Resend: su mensaje puede traer direcciones de correo.
      const detail = (await res.json().catch(() => null)) as { name?: unknown } | null;
      console.error(`[email:resend] No se envió "${msg.subject}": Resend respondió ${res.status}${typeof detail?.name === 'string' ? ` (${detail.name})` : ''}.`);
    } catch (err) {
      console.error('[email:resend] Falló envío:', err);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return { sent: true, transport: 'smtp' };
    } catch (err) {
      console.error('[email:smtp] Falló envío:', err);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    // Sin servicio de correo. El cuerpo puede traer un enlace para cambiar la clave: en producción
    // no se escribe en los registros, porque quien los lea podría entrar a la cuenta.
    console.warn(`[email] No se envió "${msg.subject}": no hay servicio de correo configurado.`);
  } else if (process.env.NODE_ENV !== 'test') {
    console.info(`[email:log] Para: ${msg.to} | Asunto: ${msg.subject}\n${msg.text}`);
  }
  return { sent: false, transport: 'log' };
}

export function renderCifraEmail(params: {
  heading: string;
  bodyParagraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): { html: string; text: string } {
  const textLines = [
    params.heading,
    '',
    ...params.bodyParagraphs,
    ...(params.ctaLabel && params.ctaUrl ? ['', `${params.ctaLabel}: ${params.ctaUrl}`] : []),
    '',
    params.footerNote ?? 'CIFRA · Claridad financiera antes de gastar. Nunca te pedimos claves bancarias.',
  ];

  const paragraphsHtml = params.bodyParagraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#243530;">${escapeHtml(p)}</p>`)
    .join('');

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:24px 0;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#0B6B58;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px;">${escapeHtml(params.ctaLabel)}</a></p>`
      : '';

  const html = `<!doctype html>
<html lang="es-CO">
  <body style="margin:0;padding:24px;background:#F7F6F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#101D1A;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #DDDCD3;border-radius:20px;padding:28px;">
      <div style="font-weight:800;font-size:18px;letter-spacing:-0.02em;color:#0B6B58;margin-bottom:18px;">cifra</div>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#101D1A;">${escapeHtml(params.heading)}</h1>
      ${paragraphsHtml}
      ${ctaHtml}
      <hr style="border:none;border-top:1px dashed #C5C4B9;margin:24px 0 16px;" />
      <p style="margin:0;font-size:12.5px;line-height:1.5;color:#758580;">${escapeHtml(
        params.footerNote ?? 'CIFRA · Nunca te pedimos claves bancarias ni movemos dinero.',
      )}</p>
    </div>
  </body>
</html>`;

  return { html, text: textLines.join('\n') };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
