import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppDeps, AppModule } from './app.module';
import { Config, loadConfig, systemClock } from './config';
import { Db } from './db/db';
import { copyDemoMedia, ensurePlatformAdmin, seed } from './db/seed';
import { AssessmentService } from './modules/assessment';
import { BrevoEmailSender, ConsoleEmailSender } from './modules/email';
import { DisabledGoogleVerifier, GoogleIdTokenVerifier } from './modules/google';

export async function createApp(deps: AppDeps, opts: { quiet?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.with(deps), { logger: opts.quiet ? ['error'] : ['error', 'warn', 'log'] });
  const { config } = deps;
  if (config.corsOrigins?.length) app.enableCors({ origin: config.corsOrigins, credentials: false });
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  // La app del aprendiz vive en /app/ en el mismo origen que la API.
  const appDir = config.appDir ? resolve(config.appDir) : undefined;
  if (appDir && existsSync(appDir)) {
    app.useStaticAssets(appDir, { prefix: '/app/', index: 'index.html', maxAge: 0, etag: true });
    const http = app.getHttpAdapter().getInstance();
    http.get(['/', '/app'], (req: any, res: any) => res.redirect(302, '/app/' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
  }
  app.enableShutdownHooks();
  return app;
}

async function main() {
  const log = new Logger('Nivia');
  const config: Config = loadConfig();
  if (!process.env.APP_SECRET) log.warn('APP_SECRET no está definido: los tokens dejarán de valer al reiniciar.');
  if (!config.databaseUrl) log.warn('DATABASE_URL no está definido: se usa PGlite (solo desarrollo).');
  const db = await Db.connect({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
  const applied = await db.migrate();
  if (applied.length) log.log(`Migraciones aplicadas: ${applied.join(', ')}`);
  // En producción no se cargan datos de demostración salvo que se pida (sus cuentas usan una contraseña conocida).
  const seedOnEmpty = (process.env.SEED_ON_EMPTY ?? (config.production ? 'false' : 'true')) === 'true';
  if (seedOnEmpty && await seed(db, systemClock)) {
    log.log('Datos de demostración cargados');
    copyDemoMedia(config.storageDir, process.env.DEMO_MEDIA_DIR || '../prototipo/media');
  }
  if (await ensurePlatformAdmin(db)) log.log('Administrador de plataforma creado');

  const email = config.brevoApiKey ? new BrevoEmailSender(config.brevoApiKey, config.emailFrom) : new ConsoleEmailSender();
  if (!config.brevoApiKey) log.warn('BREVO_API_KEY no está definido: los correos se escriben en el log.');
  const google = config.googleClientId ? new GoogleIdTokenVerifier(config.googleClientId) : new DisabledGoogleVerifier();
  if (!config.googleClientId) log.warn('GOOGLE_CLIENT_ID no está definido: el ingreso con Google está apagado.');

  const app = await createApp({ config, db, clock: systemClock, email, google });
  await app.listen(config.port);
  log.log(`API escuchando en ${config.publicUrl}`);

  // Cierra evaluaciones abandonadas cuyo tiempo ya se acabó.
  const assessment = app.get(AssessmentService);
  const timer = setInterval(() => { assessment.sweepExpired().catch((e) => log.error(e)); }, 60_000);
  app.getHttpServer().on('close', () => clearInterval(timer));
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
