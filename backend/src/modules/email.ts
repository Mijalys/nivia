import { Logger } from '@nestjs/common';
import { Tenant } from './tenants';

export interface EmailMessage { to: string; toName?: string; subject: string; html: string; text: string }

/** Envío de correo. En producción, Brevo; en desarrollo, el log; en pruebas, memoria. */
export interface EmailSender {
  send(msg: EmailMessage): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  private log = new Logger('Correo');
  async send(m: EmailMessage) {
    this.log.log(`→ ${m.to} · ${m.subject}\n${m.text}`);
  }
}

export class MemoryEmailSender implements EmailSender {
  sent: EmailMessage[] = [];
  async send(m: EmailMessage) { this.sent.push(m); }
  /** Último enlace enviado a un correo (para las pruebas). */
  lastLink(to: string): string | undefined {
    const m = [...this.sent].reverse().find((x) => x.to.toLowerCase() === to.toLowerCase());
    return m?.text.match(/https?:\/\/\S+/)?.[0];
  }
}

/** Brevo, API transaccional v3. El remitente debe estar verificado en la cuenta de Brevo. */
export class BrevoEmailSender implements EmailSender {
  constructor(private apiKey: string, private from: string) {}
  async send(m: EmailMessage) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: this.from, name: 'Nivia' },
        to: [{ email: m.to, name: m.toName }],
        subject: m.subject, htmlContent: m.html, textContent: m.text
      })
    });
    if (!res.ok) throw new Error(`Brevo respondió ${res.status}: ${await res.text()}`);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * Correo con la marca del cliente: su nombre arriba, botón en su color principal.
 * Texto plano incluido para clientes de correo simples.
 */
export function brandedEmail(t: Tenant, to: string, toName: string, subject: string, lines: string[], cta: { label: string; url: string }, foot: string): EmailMessage {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F4F4F2;font-family:Arial,Helvetica,sans-serif;color:#1A1A1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden">
<tr><td style="background:${t.branding.principal};color:#FFFFFF;padding:18px 24px;font-size:18px;font-weight:bold">${esc(t.name)}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5">
${lines.map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join('')}
<p style="margin:24px 0"><a href="${cta.url}" style="display:inline-block;background:${t.branding.principal};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">${esc(cta.label)}</a></p>
<p style="margin:0;font-size:13px;color:#4D4D4D">${esc(foot)}</p>
</td></tr></table>
<p style="font-size:12px;color:#4D4D4D;margin:16px 0 0">Capacitación de ${esc(t.name)} · Con Nivia</p>
</td></tr></table></body></html>`;
  const text = `${t.name}\n\n${lines.join('\n\n')}\n\n${cta.label}: ${cta.url}\n\n${foot}`;
  return { to, toName, subject, html, text };
}
