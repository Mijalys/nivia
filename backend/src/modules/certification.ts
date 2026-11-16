import { Controller, Get, Inject, Injectable, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { Auth, AuthCtx, Public, tenantSlugFrom } from '../common/auth';
import { certificateCode, isValidCertificateCode } from '../common/crypto';
import { notFound, parse, uuid } from '../common/errors';
import { CLOCK, Clock, DB } from '../config';
import { Db, Q } from '../db/db';
import { audit } from './identity';
import { AssignmentRow, EXPIRING_SOON_DAYS } from './learning';
import { Tenant, TenantsService } from './tenants';

interface CertRow {
  id: string;
  user_id: string;
  route_title: string;
  score: number;
  code: string;
  issued_at: Date;
  expires_at: Date;
  status: 'valid' | 'revoked';
  first_name: string;
  last_name: string;
}

const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

@Injectable()
export class CertificationService {
  constructor(@Inject(DB) private db: Db, @Inject(CLOCK) private clock: Clock, private tenants: TenantsService) {}

  /** Solo se llama al aprobar, dentro de la transacción de la calificación. */
  async issue(q: Q, tenant: Tenant, userId: string, a: AssignmentRow, score: number) {
    const issued = this.clock.now();
    const expires = new Date(issued);
    expires.setUTCMonth(expires.getUTCMonth() + tenant.cert_validity_months);
    for (let i = 0; i < 5; i++) {
      const code = certificateCode(tenant.cert_prefix, issued.getUTCFullYear());
      const taken = (await q.query('select 1 from certificate where code = $1', [code])).rows.length;
      if (taken) continue;
      const row = (await q.query<{ id: string }>(
        `insert into certificate (tenant_id, user_id, assignment_id, route_title, score, code, issued_at, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [tenant.id, userId, a.id, a.title, score, code, issued, expires])).rows[0];
      await q.query("insert into outbox (tenant_id, type, payload) values ($1, 'certificate.issued', $2::jsonb)",
        [tenant.id, JSON.stringify({ certificate_id: row.id })]);
      await audit(q, tenant.id, userId, 'certificate.issued', { certificate_id: row.id, code });
      return { id: row.id, code };
    }
    throw new Error('No se pudo generar un código de certificado único');
  }

  private view(c: CertRow) {
    const now = this.clock.now();
    const days = Math.floor((c.expires_at.getTime() - now.getTime()) / 86_400_000);
    const state: 'revoked' | 'expired' | 'expiring_soon' | 'valid' =
      c.status === 'revoked' ? 'revoked' : days < 0 ? 'expired' : days <= EXPIRING_SOON_DAYS ? 'expiring_soon' : 'valid';
    return {
      id: c.id, route_title: c.route_title, score: c.score, code: c.code,
      holder: `${c.first_name} ${c.last_name}`,
      issued_at: c.issued_at.toISOString(), expires_at: c.expires_at.toISOString(),
      days_left: days, state
    };
  }

  private rows(q: Q, where: string, params: unknown[]) {
    return q.query<CertRow>(
      `select c.*, u.first_name, u.last_name from certificate c join app_user u on u.id = c.user_id where ${where}`, params);
  }

  /** Próximos a vencer arriba, luego vigentes, y al final vencidos o revocados. */
  async list(auth: AuthCtx) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const items = (await this.rows(q, 'c.user_id = $1', [auth.userId])).rows.map((c) => this.view(c));
      const rank = { expiring_soon: 0, valid: 1, expired: 2, revoked: 3 } as const;
      items.sort((x, y) => rank[x.state] - rank[y.state] || x.days_left - y.days_left);
      return { certificates: items };
    });
  }

  async get(auth: AuthCtx, id: string) {
    return this.db.tenant(auth.tenantId, async (q) => {
      const c = (await this.rows(q, 'c.id = $1 and c.user_id = $2', [id, auth.userId])).rows[0];
      if (!c) throw notFound('Certificado');
      const t = await this.tenants.byId(q, auth.tenantId);
      return { ...this.view(c), company: t.name,
        statement: `${t.name} certifica que ${c.first_name} ${c.last_name} aprobó la capacitación interna «${c.route_title}», definida por la empresa.`,
        disclaimer: `Capacitación interna de ${t.name}. No constituye una certificación externa.` };
    });
  }

  async pdf(auth: AuthCtx, id: string, res: Response) {
    const { c, t } = await this.db.tenant(auth.tenantId, async (q) => {
      const c = (await this.rows(q, 'c.id = $1 and c.user_id = $2', [id, auth.userId])).rows[0];
      if (!c) throw notFound('Certificado');
      return { c, t: await this.tenants.byId(q, auth.tenantId) };
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificado-${c.code}.pdf"`);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 56 });
    doc.pipe(res);
    const W = doc.page.width;
    doc.rect(0, 0, W, 14).fill(t.branding.principal);
    doc.fillColor(t.branding.principal).fontSize(20).font('Helvetica-Bold').text(t.name, 56, 56);
    doc.fillColor('#4D4D4D').fontSize(10).font('Helvetica').text('CERTIFICADO DE CAPACITACIÓN INTERNA', 56, 62, { align: 'right', characterSpacing: 2 });
    doc.moveDown(4).fillColor('#4D4D4D').fontSize(14).text(`${t.name} certifica que`, 56);
    doc.moveDown(0.6).fillColor('#1A1A1A').fontSize(34).font('Helvetica-Bold').text(`${c.first_name} ${c.last_name}`);
    doc.moveDown(0.6).fillColor('#333333').fontSize(14).font('Helvetica')
      .text(`aprobó la capacitación interna «${c.route_title}», definida por la empresa.`);
    const y = 380;
    const cols: [string, string][] = [['Fecha', fmt(c.issued_at)], ['Resultado', `${c.score} %`], ['Vigente hasta', fmt(c.expires_at)], ['Código de verificación', c.code]];
    cols.forEach(([k, v], i) => {
      const x = 56 + i * ((W - 112) / 4);
      doc.fillColor('#4D4D4D').fontSize(10).font('Helvetica').text(k, x, y);
      doc.fillColor('#1A1A1A').fontSize(14).font('Helvetica-Bold').text(v, x, y + 16);
    });
    doc.fillColor('#4D4D4D').fontSize(9).font('Helvetica')
      .text(`Capacitación interna de ${t.name}. No constituye una certificación externa.`, 56, doc.page.height - 80);
    doc.end();
  }

  /** Verificación por código, dentro de la empresa. La verificación pública queda para una fase posterior. */
  async verify(slug: string, code: string) {
    if (!isValidCertificateCode(code)) return { valid: false, reason: 'MALFORMED_CODE' };
    const tenant = await this.tenants.bySlug(slug);
    return this.db.tenant(tenant.id, async (q) => {
      const c = (await this.rows(q, 'c.code = $1', [code])).rows[0];
      if (!c) return { valid: false, reason: 'NOT_FOUND' };
      const v = this.view(c);
      return { valid: v.state === 'valid' || v.state === 'expiring_soon', state: v.state, holder: v.holder,
        route_title: v.route_title, issued_at: v.issued_at, expires_at: v.expires_at, company: tenant.name };
    });
  }
}

@Controller('certificates')
export class CertificationController {
  constructor(private svc: CertificationService) {}

  @Get() list(@Auth() a: AuthCtx) { return this.svc.list(a); }
  @Public() @Get('verify/:code') verify(@Req() req: Request, @Param('code') code: string) { return this.svc.verify(tenantSlugFrom(req), code); }
  @Get(':id') get(@Auth() a: AuthCtx, @Param('id') id: string) { return this.svc.get(a, parse(uuid, id)); }
  @Get(':id/pdf') pdf(@Auth() a: AuthCtx, @Param('id') id: string, @Res() res: Response) { return this.svc.pdf(a, parse(uuid, id), res); }
}
