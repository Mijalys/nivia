import { Logger } from '@nestjs/common';

/** Envío de SMS o WhatsApp. El proveedor real (decisión D4) implementa esta interfaz. */
export interface SmsSender {
  send(phoneE164: string, text: string): Promise<void>;
}

/** Desarrollo: escribe el mensaje en el log en lugar de enviarlo. */
export class ConsoleSmsSender implements SmsSender {
  private log = new Logger('SMS');
  async send(phone: string, text: string) {
    this.log.log(`→ ${phone}: ${text}`);
  }
}

/** Pruebas: guarda los mensajes para leer el código enviado. */
export class MemorySmsSender implements SmsSender {
  sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string) {
    this.sent.push({ phone, text });
  }
  lastCode(phone: string): string | undefined {
    const m = [...this.sent].reverse().find((s) => s.phone === phone);
    return m?.text.match(/\b(\d{6})\b/)?.[1];
  }
}

/** Celular peruano de 9 dígitos a formato E.164 (+51…). */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9')) return `+51${digits}`;
  if (digits.length === 11 && digits.startsWith('51')) return `+${digits}`;
  return `+${digits}`;
}
