import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppDeps, AppModule } from './app.module';
import { Config, loadConfig, systemClock } from './config';
import { Db } from './db/db';
import { copyDemoMedia, seed } from './db/seed';
import { AssessmentService } from './modules/assessment';
import { BrevoEmailSender, ConsoleEmailSender } from './modules/email';
import { DisabledGoogleVerifier, GoogleIdTokenVerifier } from './modules/google';

export async function createApp(deps: AppDeps, opts: { quiet?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.with(deps), { logger: opts.quiet ? ['error'] : ['error', 'warn', 'log'] });
  app.enableCors({ origin: true, credentials: false });
  app.enableShutdownHooks();
  return app;
}

async function main() {
  const log = new Logger('Nivia');
  const config: Config = loadConfig();
  if (!process.env.APP_SECRET) log.warn('APP_SECRET no está definido: los tokens dejarán de valer al reiniciar.');
  const db = await Db.connect({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
  const applied = await db.migrate();
  if (applied.length) log.log(`Migraciones aplicadas: ${applied.join(', ')}`);
  if (process.env.SEED_ON_EMPTY !== 'false' && await seed(db, systemClock)) log.log('Datos de demostración cargados');
  copyDemoMedia(config.storageDir, process.env.DEMO_MEDIA_DIR || '../prototipo/media');

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
