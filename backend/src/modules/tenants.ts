import { Controller, Get, Inject, Injectable, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public, tenantSlugFrom } from '../common/auth';
import { ApiError } from '../common/errors';
import { CONFIG, Config, DB } from '../config';
import { Db, Q } from '../db/db';

export interface Branding {
  mono: string;
  accent: string;
  on_accent: string;
  principal: string;
  principal_text: string;
  logo_url: string | null;
  areas: string[];
}

export interface ExamPolicy {
  min_score: number;
  attempts: number;
  wait_minutes: number;
  question_count: number;
  minutes: number;
  /** Qué hacer al agotar intentos, en palabras del cliente. */
  exhausted_message: string;
  /** Pausa total permitida si se corta la señal durante la evaluación (decisión D6). */
  max_pause_minutes: number;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: Branding;
  exam_policy: ExamPolicy;
  cert_prefix: string;
  cert_validity_months: number;
}

@Injectable()
export class TenantsService {
  constructor(@Inject(DB) private db: Db, @Inject(CONFIG) private cfg: Config) {}

  async bySlug(slug: string): Promise<Tenant> {
    const row = await this.db.anon((q) => q.query<Tenant>('select * from tenant where slug = $1', [slug]));
    if (!row.rows[0]) throw new ApiError(404, 'TENANT_NOT_FOUND', 'Empresa no encontrada.');
    return row.rows[0];
  }

  async byId(q: Q, id: string): Promise<Tenant> {
    const row = await q.query<Tenant>('select * from tenant where id = $1', [id]);
    if (!row.rows[0]) throw new ApiError(404, 'TENANT_NOT_FOUND', 'Empresa no encontrada.');
    return row.rows[0];
  }

  /** Lo que la PWA necesita para pintar la marca y explicar las reglas, sin datos internos. */
  publicConfig(t: Tenant) {
    return {
      slug: t.slug,
      name: t.name,
      branding: t.branding,
      exam_policy: t.exam_policy,
      // La app muestra "Continuar con Google" solo si hay un Client ID configurado.
      sign_in: { email_password: true, email_link: true, google_client_id: this.cfg.googleClientId ?? null }
    };
  }
}

@Controller('tenant')
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Public()
  @Get('config')
  async config(@Req() req: Request) {
    return this.tenants.publicConfig(await this.tenants.bySlug(tenantSlugFrom(req)));
  }
}
